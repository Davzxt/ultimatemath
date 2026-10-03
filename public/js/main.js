import { io } from '/socket.io/socket.io.esm.min.js';
import * as W from './scene.js';
import { generateQuestion } from './questions.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const OPNAME = { add: '➕ Adição', sub: '➖ Subtração', mul: '✖️ Multiplicação', div: '➗ Divisão', mix: '🧩 Expressão' };

const S = { role: null, pid: null, pin: null, token: null, name: store.get('um_name', ''), avatar: store.get('um_avatar', null), players: new Map(), q: null, answered: false, myChoice: -1, score: 0, timers: [], screen: 'loading', report: null, solo: null };
let socket;

// ---------------- SOM (sintetizado) ----------------
const Snd = {
  ctx: null, on: store.get('um_sound', true), music: null,
  init() { if (!this.ctx) try { this.ctx = new AudioContext(); } catch {} if (this.ctx?.state === 'suspended') this.ctx.resume(); },
  tone(f, d = 0.15, type = 'sine', v = 0.12, when = 0) {
    if (!this.on || !this.ctx) return; const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d + 0.02);
  },
  seq(ns, step = 0.1, type = 'triangle', v = 0.12) { ns.forEach((f, i) => f && this.tone(f, step * 1.6, type, v, i * step)); },
  click() { this.tone(660, 0.06, 'square', 0.05); },
  pop() { this.seq([520, 780], 0.05, 'sine', 0.1); },
  correct() { this.seq([523, 659, 784, 1047], 0.09, 'triangle', 0.14); },
  wrong() { this.seq([311, 233], 0.16, 'sawtooth', 0.07); },
  tick() { this.tone(1200, 0.04, 'square', 0.04); },
  go() { this.seq([392, 523, 784], 0.08, 'square', 0.06); },
  fanfare() { this.seq([523, 523, 523, 659, 0, 523, 659, 784, 784, 1047], 0.12, 'triangle', 0.13); },
  startMusic() {
    if (this.music) return; const scale = [262, 294, 330, 392, 440, 523, 587, 659]; let i = 0;
    const bass = [131, 110, 147, 98];
    this.music = setInterval(() => { if (i % 8 === 0) this.tone(bass[(i / 8) % 4], 1.6, 'sine', 0.06); if (i % 2 === 0 || Math.random() < 0.3) this.tone(scale[(i * 3 + (i >> 2)) % 8] * (Math.random() < 0.2 ? 2 : 1), 0.25, 'triangle', 0.035); i++; }, 220);
  },
  stopMusic() { clearInterval(this.music); this.music = null; },
};
$('#btnMute').onclick = () => { Snd.on = !Snd.on; store.set('um_sound', Snd.on); $('#btnMute').textContent = Snd.on ? '🔊' : '🔇'; if (!Snd.on) Snd.stopMusic(); else musicFor(S.screen); };
$('#btnMute').textContent = Snd.on ? '🔊' : '🔇';
addEventListener('pointerdown', () => Snd.init(), { once: false });
document.addEventListener('click', (e) => { if (e.target.closest('button')) Snd.click(); });
const musicFor = (id) => (['home', 'custom', 'lobby'].includes(id) && Snd.on ? Snd.startMusic() : Snd.stopMusic());

// ---------------- UTILITÁRIOS DE TELA ----------------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
  S.screen = id; musicFor(id);
  const emo = (S.role === 'player' || S.role === 'solo') && ['lobby', 'reveal', 'end'].includes(id);
  $('#emoteBar').classList.toggle('show', emo);
  W.setCamera({ home: 'orbit', tlogin: 'orbit', tsetup: 'orbit', custom: 'custom', lobby: 'lobby', game: 'question', reveal: 'question', end: 'podium' }[id] || 'orbit');
}
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
const clearTimers = () => { S.timers.forEach(clearTimeout); S.timers.forEach(clearInterval); S.timers = []; };
const later = (fn, ms) => S.timers.push(setTimeout(fn, ms));
document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => {
  if (S.role === 'player' || S.role === 'host') { sessionStorage.clear(); return location.reload(); }
  if (S.role === 'solo') { clearTimers(); W.clearAvatars(); W.hidePodium(); W.revealPads(-1); }
  S.role = null; document.body.className = ''; W.removeAvatar('preview'); show(b.dataset.go);
}));

// ---------------- HOME ----------------
$('#pinInput').addEventListener('input', (e) => (e.target.value = e.target.value.replace(/\D/g, '')));
$('#pinInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btnJoin').click());
$('#btnJoin').onclick = () => {
  const pin = $('#pinInput').value.trim();
  if (pin.length !== 6) return toast('Digite o PIN de 6 números que está na tela do professor 😉');
  S.role = 'player'; S.pin = pin; openCustom();
};
$('#btnSolo').onclick = () => { S.role = 'solo'; openCustom(); };
$('#btnTeacher').onclick = () => { show('tlogin'); setTimeout(() => $('#tUser').focus(), 50); };

// ---------------- CUSTOMIZAÇÃO ----------------
const TABS = [
  ['body', '🎨 Cor', W.BODY_COLORS.map((c) => ({ color: c }))],
  ['skin', '✋ Pele', W.SKIN_COLORS.map((c) => ({ color: c }))],
  ['hat', '🎩 Chapéu', W.HATS.map((n, i) => ({ em: ['🚫', '🧢', '👑', '🧙', '🎩', '🐱', '😈', '🚁', '🎧'][i], n }))],
  ['eyes', '👀 Olhos', W.EYES.map((n, i) => ({ em: ['🙂', '🤩', '😎', '😴'][i], n }))],
  ['acc', '🎒 Extra', W.ACCS.map((n, i) => ({ em: ['🚫', '🦸', '🎒', '🧣', '🪽'][i], n }))],
];
const randomAvatar = () => ({ body: rnd(12), skin: rnd(6), hat: rnd(9), eyes: rnd(4), acc: rnd(5) });
const rnd = (n) => Math.floor(Math.random() * n);
let tab = 'body';
function openCustom() {
  S.avatar = S.avatar || randomAvatar();
  $('#nameInput').value = S.name;
  W.clearAvatars(); W.hidePodium(); W.revealPads(-1);
  W.addAvatar('preview', S.avatar, '', 0, 0); W.spinAvatar('preview', 0.5);
  renderTabs(); show('custom');
}
function renderTabs() {
  $('#tabs').innerHTML = ''; TABS.forEach(([k, label]) => { const b = el('button', k === tab ? 'on' : '', label); b.onclick = () => { tab = k; renderTabs(); }; $('#tabs').append(b); });
  const [, , opts] = TABS.find((t) => t[0] === tab);
  $('#options').innerHTML = '';
  opts.forEach((o, i) => {
    const b = el('button', 'opt' + (S.avatar[tab] === i ? ' on' : ''), o.color ? '' : `<div><span class="em">${o.em}</span>${o.n}</div>`);
    if (o.color) b.style.background = o.color;
    b.onclick = () => { S.avatar[tab] = i; updatePreview(); renderTabs(); };
    $('#options').append(b);
  });
}
function updatePreview(emoteIdx) { W.addAvatar('preview', S.avatar, '', 0, 0); W.spinAvatar('preview', 0.5); W.emote('preview', emoteIdx ?? [0, 1, 4, 6][rnd(4)]); Snd.pop(); }
$('#btnRandom').onclick = () => { S.avatar = randomAvatar(); updatePreview(1); renderTabs(); };
$('#nameInput').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btnReady').click());
$('#btnReady').onclick = () => {
  const name = $('#nameInput').value.trim();
  if (!name) { toast('Escolha um apelido! ✍️'); return $('#nameInput').focus(); }
  S.name = name; store.set('um_name', name); store.set('um_avatar', S.avatar);
  W.removeAvatar('preview');
  if (S.role === 'solo') return startSolo();
  join();
};

// ---------------- SOCKET ----------------
function connect() {
  if (socket) return socket;
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    if (S.role === 'player' && S.pid) join(true);
    if (S.role === 'host' && S.pin) socket.emit('host:rejoin', { token: S.token, pin: S.pin }, (r) => r.ok ? toast('Reconectado ✔') : toast('A sala expirou 😢'));
  });
  socket.on('disconnect', () => toast('Conexão perdida… tentando reconectar 🔄', 4000));
  socket.on('room:players', syncPlayers);
  socket.on('player:moved', ({ id, x, z }) => W.moveAvatar(id, x, z));
  socket.on('emote', ({ id, e }) => { W.emote(id, e); if (id === S.pid) Snd.pop(); });
  socket.on('game:starting', () => { clearTimers(); show('game'); prepUI(); $('#qcard').style.display = 'none'; $('#ready').style.display = 'block'; $('#readyTxt').textContent = 'O jogo vai começar!'; Snd.go(); W.ringLayout(playerIds()); });
  socket.on('game:question', showQuestion);
  socket.on('player:answered', () => {});
  socket.on('game:answerCount', ({ n, total }) => ($('#ansCount').textContent = `${n}/${total} responderam`));
  socket.on('game:reveal', handleReveal);
  socket.on('game:end', handleEnd);
  socket.on('host:report', renderReport);
  socket.on('game:lobby', () => { clearTimers(); W.hidePodium(); W.revealPads(-1); S.score = 0; enterLobby(); });
  socket.on('kicked', () => { alert('Você foi removido da sala pelo professor.'); sessionStorage.clear(); location.reload(); });
  return socket;
}
const playerIds = () => [...S.players.keys()];

function join(silent) {
  connect();
  const saved = JSON.parse(sessionStorage.getItem('um_session') || 'null');
  const pid = S.pid || (saved?.pin === S.pin ? saved.pid : null);
  socket.emit('player:join', { pin: S.pin, name: S.name, avatar: S.avatar, pid }, (r) => {
    if (!r.ok) { if (!silent) { toast(r.error); show('home'); S.role = null; } return; }
    S.pid = r.pid; S.pin = r.pin; S.score = r.me.score;
    sessionStorage.setItem('um_session', JSON.stringify({ pin: S.pin, pid: S.pid }));
    syncPlayers(r.players);
    if (silent) return;
    if (r.state === 'question') { show('game'); showQuestion(r.question); }
    else if (r.state === 'lobby') enterLobby();
    else { show('game'); prepUI(); $('#qcard').style.display = 'none'; $('#ready').style.display = 'block'; $('#readyTxt').textContent = 'Entrando na próxima questão…'; }
  });
}

function syncPlayers(list) {
  const ids = new Set(list.map((p) => p.id));
  for (const id of W.avatarIds()) if (!ids.has(id) && id !== 'preview') W.removeAvatar(id);
  for (const p of list) {
    if (!S.players.has(p.id) || !W.hasAvatar(p.id)) { W.addAvatar(p.id, p.avatar, (p.id === S.pid ? '★ ' : '') + p.name, p.x, p.z); if (S.screen === 'lobby') Snd.pop(); }
  }
  S.players = new Map(list.map((p) => [p.id, p]));
  $('#pCount').textContent = list.filter((p) => p.connected).length;
  const pl = $('#plist'); pl.innerHTML = '';
  for (const p of list) {
    const c = el('div', 'p' + (p.connected ? '' : ' off'), esc(p.name));
    if (S.role === 'host') { const k = el('button', '', '✕'); k.title = 'Remover'; k.onclick = () => confirm(`Remover ${p.name}?`) && socket.emit('host:kick', p.id); c.append(k); }
    pl.append(c);
  }
  $('#btnStart').disabled = !list.length;
}

function enterLobby() {
  show('lobby');
  $('#lobbyHost').style.display = S.role === 'host' ? 'flex' : 'none';
  $('#lobbyPlayer').style.display = S.role === 'player' ? 'flex' : 'none';
  for (const [id, p] of S.players) W.moveAvatar(id, p.x, p.z), W.setMood(id, null);
}

// andar clicando no chão
W.setGroundHandler((x, z) => {
  if (!['lobby', 'reveal'].includes(S.screen)) return;
  if (S.role === 'player' && S.pid) { W.moveAvatar(S.pid, x, z); socket.emit('player:move', { x, z }); }
  if (S.role === 'solo') W.moveAvatar('me', x, z);
});

// emotes
W.EMOTES.forEach(([em, label], i) => { const b = el('button', '', `${em}<i>${i + 1}</i>`); b.title = label; b.onclick = () => sendEmote(i); $('#emoteBar').append(b); });
function sendEmote(i) { if (S.role === 'solo') { W.emote('me', i); Snd.pop(); } else if (S.role === 'player') socket.emit('emote', i); }
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const n = +e.key;
  if (S.screen === 'game' && n >= 1 && n <= 4) { const b = $('#answers').children[n - 1]; if (b && !b.disabled) b.click(); return; }
  if (n >= 1 && n <= 8 && $('#emoteBar').classList.contains('show')) sendEmote(n - 1);
});

// ---------------- PROFESSOR ----------------
$('#loginForm').onsubmit = (e) => {
  e.preventDefault(); connect();
  socket.emit('host:login', { user: $('#tUser').value, pass: $('#tPass').value }, (r) => {
    if (!r.ok) { $('#loginErr').textContent = 'Usuário ou senha incorretos.'; Snd.wrong(); return; }
    S.token = r.token; $('#loginErr').textContent = ''; $('#tPass').value = ''; show('tsetup');
  });
};
$('#opsChips').onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; c.classList.toggle('on'); if (!$('#opsChips .on')) c.classList.add('on'); };
$('#diffChips').onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; $('#diffChips .on')?.classList.remove('on'); c.classList.add('on'); };
$('#count').oninput = (e) => ($('#countVal').textContent = e.target.value);
$('#time').oninput = (e) => ($('#timeVal').textContent = e.target.value);
$('#btnCreate').onclick = () => {
  const settings = { ops: [...document.querySelectorAll('#opsChips .on')].map((c) => c.dataset.op), difficulty: $('#diffChips .on').dataset.d, count: +$('#count').value, time: +$('#time').value, auto: $('#auto').checked };
  socket.emit('host:create', { token: S.token, settings }, (r) => {
    if (!r.ok) { toast(r.error); return show('tlogin'); }
    S.role = 'host'; S.pin = r.pin; document.body.className = 'is-host';
    $('#pinShow').textContent = r.pin; $('#siteUrl').textContent = location.host;
    W.clearAvatars(); syncPlayers([]); enterLobby();
  });
};
$('#btnStart').onclick = () => socket.emit('host:start');
$('#btnSkip').onclick = () => socket.emit('host:skip');
$('#btnNext').onclick = () => (S.role === 'solo' ? soloNext() : socket.emit('host:next'));
$('#btnAgain').onclick = () => (S.role === 'solo' ? startSolo() : socket.emit('host:again'));
$('#btnCsv').onclick = () => {
  if (!S.report) return;
  const rows = [['Aluno', 'Pontos', 'Acertos', 'Total', '%', 'Adição %', 'Subtração %', 'Multiplicação %', 'Divisão %', 'Expressões %']];
  for (const p of S.report.players) rows.push([p.name, p.score, p.correct, p.total, pct(p.correct, p.total), ...['add', 'sub', 'mul', 'div', 'mix'].map((o) => (p.stats[o] ? pct(...p.stats[o]) : ''))]);
  rows.push([], ['Questão', 'Operação', 'Resposta', '% acerto']);
  for (const q of S.report.questions) rows.push([q.q, OPNAME[q.op] || q.op, q.answer, pct(q.right, q.total)]);
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = el('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `ultimatemath-${S.pin}.csv`; a.click();
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ---------------- QUESTÃO ----------------
function prepUI() {
  $('#answers').innerHTML = ''; $('#waitMsg').style.display = 'none'; $('#qcard').style.display = '';
  $('#game').classList.toggle('host-view', S.role === 'host');
}
function showQuestion(q) {
  clearTimers(); S.q = q; S.answered = !!q.answered; S.myChoice = -1;
  show('game'); prepUI();
  W.revealPads(-1); W.hidePodium(); W.ringLayout(S.role === 'solo' ? ['me'] : playerIds());
  $('#qNum').innerHTML = S.role === 'solo' ? `<span class="lives">${'❤️'.repeat(S.solo.lives)}${'🖤'.repeat(3 - S.solo.lives)}</span> ${q.index}` : `${q.index}/${q.total}`;
  $('#scorePill').textContent = '⭐ ' + S.score.toLocaleString('pt-BR');
  $('#qTag').textContent = q.double ? '⚡ PONTOS EM DOBRO! ⚡' : OPNAME[q.op] || 'Desafio';
  $('#qTag').classList.toggle('double', !!q.double);
  $('#qText').textContent = q.q; $('#qText').classList.toggle('small', q.q.length > 34);
  $('#ansCount').textContent = `0/${[...S.players.values()].filter((p) => p.connected).length} responderam`;
  q.choices.forEach((c, i) => {
    const b = el('button', `ans c${i}${q.small ? ' small' : ''}`, `<span class="sh">${W.PAD_SHAPES[i]}</span><span class="tx">${esc(c)}</span>`);
    b.disabled = S.role === 'host';
    b.onclick = () => answer(i);
    $('#answers').append(b);
  });
  $('#answers').style.display = 'none'; $('#ready').style.display = 'block';
  $('#readyTxt').textContent = q.double ? '⚡ DOBRO! ⚡' : 'Prepare-se!';
  if (q.ready > 200) Snd.go();
  const end = Date.now() + q.left; S.qEnd = end;
  later(() => {
    $('#ready').style.display = 'none';
    if (S.answered) $('#waitMsg').style.display = 'block'; else $('#answers').style.display = 'grid';
  }, q.ready);
  let lastSec = -1;
  const iv = setInterval(() => {
    const ms = Math.max(0, end - Date.now()), sec = Math.ceil(ms / 1000);
    const frac = Math.min(1, ms / (q.time * 1000));
    $('#timerArc').style.strokeDashoffset = 119.4 * (1 - frac);
    $('#timerTxt').textContent = sec;
    $('.timer').classList.toggle('hurry', sec <= 5 && ms > 0);
    if (sec !== lastSec && sec <= 5 && sec > 0 && Date.now() > end - q.time * 1000) Snd.tick();
    lastSec = sec;
    if (ms <= 0) { clearInterval(iv); $('.timer').classList.remove('hurry'); if (S.role === 'solo' && !S.answered) answer(-1); }
  }, 100);
  S.timers.push(iv);
}

function answer(i) {
  if (S.answered || S.role === 'host') return;
  S.answered = true; S.myChoice = i;
  if (S.role === 'solo') return soloAnswer(i);
  socket.emit('player:answer', i);
  $('#answers').style.display = 'none';
  $('#waitMsg').innerHTML = `Resposta enviada! <span style="color:${W.PAD_COLORS[i]}">${W.PAD_SHAPES[i]}</span><small>Aguardando os colegas… 🤞</small>`;
  $('#waitMsg').style.display = 'block';
}

function handleReveal(r) {
  clearTimers();
  const choices = {}; for (const [id, x] of Object.entries(r.results)) choices[id] = x.choice;
  W.padLayout(choices); W.revealPads(r.correct);
  const mine = r.results[S.pid];
  later(() => { for (const [id, x] of Object.entries(r.results)) W.setMood(id, x.ok ? 'happy' : 'sad'); }, 1100);
  show('reveal');
  const ban = $('#rBanner');
  if (S.role === 'host') {
    const tot = Object.values(r.results).filter((x) => x.choice >= 0).length, ok = Object.values(r.results).filter((x) => x.ok).length;
    ban.className = 'banner ' + (ok >= tot / 2 ? 'ok' : 'bad'); ban.innerHTML = `${ok} de ${Object.keys(r.results).length} acertaram<small>${r.last ? 'Última questão!' : ''}</small>`;
    if (ok) later(() => W.burstConfetti(), 900);
  } else if (mine) {
    S.score = mine.score;
    if (mine.ok) { ban.className = 'banner ok'; ban.innerHTML = `Acertou! 🎉<small>+${mine.gained} pontos</small>${mine.streak > 1 ? `<span class="streak">🔥 ${mine.streak} seguidas!</span>` : ''}`; Snd.correct(); later(() => W.burstConfetti(), 900); }
    else if (mine.choice < 0) { ban.className = 'banner none'; ban.innerHTML = 'Tempo esgotado! ⏰<small>Na próxima você consegue!</small>'; Snd.wrong(); }
    else { ban.className = 'banner bad'; ban.innerHTML = `Quase! 😅<small>Veja abaixo como resolver</small>`; Snd.wrong(); }
  }
  $('#rAnswer').innerHTML = `Resposta certa: <span style="color:${W.PAD_COLORS[r.correct]}">${W.PAD_SHAPES[r.correct]}</span> ${esc(S.q.choices[r.correct])}`;
  $('#rExpl').textContent = r.expl;
  $('#reveal').classList.toggle('host-view', S.role === 'host');
  const max = Math.max(1, ...(r.counts || [0]));
  $('#rBars').innerHTML = (r.counts || []).map((n, i) => `<div class="c${i}${i === r.correct ? '' : ' dim'}" style="height:${30 + (n / max) * 60}px">${n}</div>`).join('');
  $('#rRank').innerHTML = (r.ranking || []).map((p, i) => `<div class="r${p.id === S.pid ? ' me' : ''}" style="animation-delay:${i * 0.07}s"><span>${['🥇', '🥈', '🥉', '4º', '5º'][i]} ${esc(p.name)}</span><span>${p.score.toLocaleString('pt-BR')}</span></div>`).join('');
  $('#btnNext').textContent = r.last ? 'VER PÓDIO 🏆' : 'PRÓXIMA ▶';
  $('#scorePill').textContent = '⭐ ' + S.score.toLocaleString('pt-BR');
}

function handleEnd({ ranking }) {
  clearTimers(); show('end');
  W.showPodium(ranking.slice(0, 3).map((p) => p.id)); Snd.fanfare();
  later(() => W.burstConfetti(), 1500);
  $('#endRank').innerHTML = ranking.map((p, i) => `<div class="r${p.id === S.pid ? ' me' : ''}"><span class="n">${['🥇', '🥈', '🥉'][i] || i + 1 + 'º'}</span><span class="nm">${esc(p.name)}</span><span>${p.score.toLocaleString('pt-BR')} pts</span></div>`).join('');
  const me = ranking.findIndex((p) => p.id === S.pid);
  $('#myPos').textContent = S.role === 'player' && me >= 0 ? (me < 3 ? `Você ficou em ${me + 1}º lugar! Incrível! 🤩` : `Você ficou em ${me + 1}º lugar. Mandou bem! 💪`) : '';
}

function renderReport(rep) {
  S.report = rep;
  const ops = ['add', 'sub', 'mul', 'div', 'mix'], cls = (v) => (v === '' ? '' : v < 50 ? 'bad' : v >= 75 ? 'good' : '');
  const cell = (s) => { const v = s ? pct(...s) : ''; return `<td class="${cls(v)}">${v === '' ? '–' : v + '%'}</td>`; };
  const hard = [...rep.questions].map((q, i) => ({ ...q, i, p: pct(q.right, q.total) })).sort((a, b) => a.p - b.p).slice(0, 3);
  $('#report').innerHTML = `<h2>📊 Relatório da turma</h2>
    <table><tr><th>Aluno</th><th>Pontos</th><th>Acertos</th><th>+</th><th>−</th><th>×</th><th>÷</th><th>( )</th></tr>
    ${rep.players.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.score}</td><td class="${cls(pct(p.correct, p.total))}">${p.correct}/${p.total}</td>${ops.map((o) => cell(p.stats[o])).join('')}</tr>`).join('')}</table>
    <h2 style="margin-top:14px">🧐 Questões mais difíceis</h2>
    <table><tr><th>#</th><th>Questão</th><th>Resposta</th><th>Acerto</th></tr>${hard.map((q) => `<tr><td>${q.i + 1}</td><td>${esc(q.q)}</td><td>${esc(q.answer)}</td><td class="${cls(q.p)}">${q.p}%</td></tr>`).join('')}</table>`;
}

// ---------------- TREINO SOLO ----------------
function startSolo() {
  clearTimers(); W.clearAvatars(); W.hidePodium(); S.score = 0; S.pid = 'me'; S.players = new Map();
  S.solo = { lives: 3, n: 0, streak: 0, correct: 0, best: store.get('um_best', 0) };
  document.body.className = 'solo';
  W.addAvatar('me', S.avatar, '★ ' + S.name, 0, 0);
  soloNext();
}
function soloNext() {
  const so = S.solo;
  if (so.lives <= 0) return soloEnd();
  so.n++;
  const d = Math.min(3, 1 + Math.floor(so.correct / 5));
  const q = generateQuestion({ difficulty: d });
  so.q = q;
  showQuestion({ index: so.n, total: '∞', q: q.q, choices: q.choices, op: q.op, small: q.small, double: so.n > 3 && Math.random() < 0.12, time: 25 - d * 3, ready: 1500, left: 1500 + (25 - d * 3) * 1000 });
}
function soloAnswer(i) {
  const so = S.solo, q = so.q, ok = i === q.correct;
  const used = 1 - Math.max(0, S.qEnd - Date.now()) / (S.q.time * 1000);
  let gained = 0;
  if (ok) { so.streak++; so.correct++; gained = Math.round(1000 - 500 * Math.min(1, Math.max(0, used))) + Math.min(so.streak - 1, 5) * 100; if (S.q.double) gained *= 2; }
  else { so.streak = 0; so.lives--; }
  S.score += gained;
  handleReveal({ correct: q.correct, expl: q.expl, results: { me: { choice: i, ok, gained, score: S.score, streak: so.streak } }, ranking: [], last: so.lives <= 0 });
  $('#btnNext').textContent = so.lives <= 0 ? 'VER RESULTADO 🏁' : 'PRÓXIMA ▶';
}
function soloEnd() {
  const so = S.solo, rec = S.score > so.best; if (rec) store.set('um_best', S.score);
  handleEnd({ ranking: [{ id: 'me', name: S.name, score: S.score }] });
  $('#myPos').innerHTML = `${so.correct} acertos • ${rec ? '🏅 NOVO RECORDE!' : `Recorde: ${Math.max(so.best, S.score).toLocaleString('pt-BR')}`}`;
}
// ---------------- INÍCIO ----------------
(async () => {
  W.initScene($('#world'));
  try { await Promise.race([document.fonts.load('40px "Lilita One"'), new Promise((r) => setTimeout(r, 2500))]); } catch {}
  show('home');
  const p = new URLSearchParams(location.search).get('pin'); if (p) $('#pinInput').value = p;
})();
