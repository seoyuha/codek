// =============================================================
//  CODE K : 전통문화 비밀요원 (코드네임 방식 영어 게임) - 서버
//  실행: npm install → npm start  (기본 포트 3000)
// =============================================================
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const UNITS = require('./data/units');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 25000 });
const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));
app.get('/healthz', (req, res) => res.send('ok'));

// ---------- 그림 파일 찾기 (png/webp/jpg가 있으면 svg보다 먼저 사용) ----------
const EXTS = ['png', 'webp', 'jpg', 'jpeg', 'gif', 'svg'];
function findAsset(dir, name) {
  for (const e of EXTS) {
    const rel = `assets/${dir}/${name}.${e}`;
    if (fs.existsSync(path.join(PUBLIC, rel))) return rel;
  }
  return null;
}
const UI_ASSETS = ['title', 'background', 'agent_red', 'agent_blue', 'neutral', 'assassin', 'card_back'];
let assetCache = null, assetTime = 0;
function assetMap() {
  if (assetCache && Date.now() - assetTime < 30000) return assetCache;
  const ui = {}, cards = {};
  UI_ASSETS.forEach(n => { const p = findAsset('ui', n); if (p) ui[n] = p; });
  Object.values(UNITS).forEach(u => u.cards.forEach(c => { cards[c.id] = findAsset('cards', c.id); }));
  assetCache = { ui, cards }; assetTime = Date.now();
  return assetCache;
}
app.get('/api/assets', (req, res) => res.json(assetMap()));

// ---------- 도구 ----------
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);
const other = t => (t === 'red' ? 'blue' : 'red');
const now = () => Date.now();

// ---------- 점수 규칙 ----------
const PTS = { hit: 10, spyHit: 5, win: 30, play: 5 };
const BOARD = { size: 20, first: 7, second: 6, neutral: 6 }; // + 도깨비 1장

const classes = new Map(); // code -> class

function newCode() {
  let c; do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (classes.has(c));
  return c;
}

function createClass() {
  const cls = {
    code: newCode(), token: rid(16), teacherSocket: null, lastActive: now(),
    settings: { unit: '11', groupSize: 4, turnTime: 90, showHintKo: false, autoNext: true },
    state: 'lobby', // lobby | playing | ended
    students: new Map(), groups: [], gseq: 0
  };
  classes.set(cls.code, cls);
  return cls;
}

// ---------- 모둠 ----------
function assignGroups(cls) {
  // 진행 중인 게임 정리
  cls.groups = [];
  const list = shuffle([...cls.students.values()].filter(s => s.connected));
  cls.students.forEach(s => (s.gid = null));
  const n = list.length;
  if (!n) return;
  const g = Math.max(1, Math.ceil(n / (cls.settings.groupSize + 1)));
  for (let i = 0; i < g; i++) cls.groups.push({ gid: ++cls.gseq, name: `${i + 1}모둠`, members: [], game: null, gameNo: 0 });
  list.forEach((s, i) => { const grp = cls.groups[i % g]; grp.members.push(s.id); s.gid = grp.gid; });
  cls.groups.forEach(grp => ensurePlan(cls, grp));
}
function groupOf(cls, gid) { return cls.groups.find(g => g.gid === gid); }

function addLateStudent(cls, s) {
  if (!cls.groups.length) return;
  const grp = [...cls.groups].sort((a, b) => a.members.length - b.members.length)[0];
  grp.members.push(s.id); s.gid = grp.gid;
  const game = grp.game;
  if (game && game.phase !== 'over') {
    const t = game.teams.red.members.length <= game.teams.blue.members.length ? 'red' : 'blue';
    game.teams[t].members.push(s.id);
    s.games = s.games || 0;
  }
}

function removeFromGroup(cls, s) {
  const grp = groupOf(cls, s.gid);
  if (!grp) return;
  grp.members = grp.members.filter(id => id !== s.id);
  const game = grp.game;
  if (game) {
    ['red', 'blue'].forEach(t => {
      const tm = game.teams[t];
      if (tm.spy === s.id) tm.spy = 'AI';
      tm.members = tm.members.filter(id => id !== s.id);
    });
    clearVotes(game, s.id);
  }
  s.gid = null;
}

// ---------- 게임 ----------
// 팀 나누기 (힌트 담당을 덜 해 본 학생부터)
function planTeams(cls, grp) {
  const players = grp.members.filter(id => cls.students.has(id));
  const order = shuffle(players).sort((a, b) => (cls.students.get(a).spyCount || 0) - (cls.students.get(b).spyCount || 0));
  let red = { spy: 'AI', members: [] }, blue = { spy: 'AI', members: [] };
  const rest = [...order];
  if (rest.length >= 4) { red.spy = rest.shift(); blue.spy = rest.shift(); }
  else if (rest.length === 3) { red.spy = rest.shift(); }
  rest.forEach((id, i) => (i % 2 === 0 ? red : blue).members.push(id));
  if (Math.random() < 0.5) [red, blue] = [blue, red];
  return { red, blue, key: players.slice().sort().join(',') };
}
function planValid(cls, grp) {
  return grp.plan && grp.plan.key === grp.members.filter(id => cls.students.has(id)).slice().sort().join(',');
}
function ensurePlan(cls, grp) { if (!planValid(cls, grp)) grp.plan = planTeams(cls, grp); return grp.plan; }

function newGame(cls, grp) {
  const unit = UNITS[cls.settings.unit] || UNITS['11'];
  const plan = ensurePlan(cls, grp); grp.plan = null;
  const red = { spy: plan.red.spy, members: [...plan.red.members] }, blue = { spy: plan.blue.spy, members: [...plan.blue.members] };
  [red.spy, blue.spy].forEach(id => { if (id !== 'AI') { const s = cls.students.get(id); s.spyCount = (s.spyCount || 0) + 1; } });

  const start = Math.random() < 0.5 ? 'red' : 'blue';
  const colors = shuffle([
    ...Array(BOARD.first).fill(start), ...Array(BOARD.second).fill(other(start)),
    ...Array(BOARD.neutral).fill('neutral'), 'assassin'
  ]);
  const cards = shuffle(unit.cards).slice(0, BOARD.size).map((c, i) => ({ ...c, color: colors[i], revealed: false, by: null }));
  grp.gameNo++;
  const game = {
    no: grp.gameNo, unit: cls.settings.unit, teams: { red, blue }, cards, start, turn: start,
    phase: 'hint', hint: null, guessesLeft: 0, guessed: 0, votes: {}, passVotes: new Set(),
    deadline: null, aiAt: 0, winner: null, reason: null, nextAt: 0, events: [], seq: 0,
    hintsUsed: [], log: [], startedAt: now()
  };
  grp.game = game;
  startPhase(cls, game, 'hint');
  pushEvent(game, { type: 'start', team: start });
  return game;
}

function startPhase(cls, game, phase) {
  game.phase = phase;
  game.votes = {}; game.passVotes = new Set();
  const tt = cls.settings.turnTime;
  game.deadline = tt ? now() + tt * 1000 : null;
  game.aiAt = now() + 2500;
}

function pushEvent(game, ev) {
  ev.seq = ++game.seq; ev.t = now();
  game.events.push(ev);
  if (game.events.length > 8) game.events.shift();
}

function teamOf(game, id) {
  for (const t of ['red', 'blue']) {
    const tm = game.teams[t];
    if (tm.spy === id) return { team: t, role: 'spy' };
    if (tm.members.includes(id)) return { team: t, role: 'agent' };
  }
  return null;
}
const left = (game, t) => game.cards.filter(c => c.color === t && !c.revealed).length;

function humanAgents(cls, game, t) {
  return game.teams[t].members.filter(id => { const s = cls.students.get(id); return s && s.connected; });
}
function needVotes(cls, game, t) {
  const n = humanAgents(cls, game, t).length;
  return n <= 2 ? 1 : Math.ceil(n / 2);
}
function spyActive(cls, game, t) {
  const id = game.teams[t].spy;
  if (id === 'AI') return false;
  const s = cls.students.get(id);
  return !!(s && s.connected);
}

function giveHint(cls, game, team, word, num, byAI) {
  const unit = UNITS[game.unit];
  if (game.phase !== 'hint' || game.turn !== team) return 'not-now';
  if (!unit.hints.find(h => h.w === word)) return 'bad-word';
  num = Math.max(1, Math.min(4, parseInt(num, 10) || 1));
  game.hint = { word, num, ai: !!byAI };
  game.hintsUsed.push({ team, word, num });
  game.guessesLeft = num + 1; game.guessed = 0;
  startPhase(cls, game, 'guess');
  pushEvent(game, { type: 'hint', team, word, num, ai: !!byAI });
  game.log.push({ t: now() - game.startedAt, team, word, num, picks: [] });
  return null;
}

function clearVotes(game, id) {
  Object.keys(game.votes).forEach(k => { game.votes[k].delete(id); if (!game.votes[k].size) delete game.votes[k]; });
  game.passVotes.delete(id);
}

function vote(cls, grp, id, idx) {
  const game = grp.game; if (!game || game.phase !== 'guess') return;
  const tr = teamOf(game, id); if (!tr || tr.role !== 'agent' || tr.team !== game.turn) return;
  const card = game.cards[idx]; if (!card || card.revealed) return;
  const had = game.votes[idx] && game.votes[idx].has(id);
  clearVotes(game, id);
  if (had) return;
  (game.votes[idx] = game.votes[idx] || new Set()).add(id);
  if (game.votes[idx].size >= needVotes(cls, game, game.turn)) reveal(cls, grp, idx, [...game.votes[idx]]);
}

function passVote(cls, grp, id) {
  const game = grp.game; if (!game || game.phase !== 'guess' || game.guessed < 1) return;
  const tr = teamOf(game, id); if (!tr || tr.role !== 'agent' || tr.team !== game.turn) return;
  if (game.passVotes.has(id)) game.passVotes.delete(id); else { clearVotes(game, id); game.passVotes.add(id); }
  if (game.passVotes.size >= needVotes(cls, game, game.turn)) {
    pushEvent(game, { type: 'pass', team: game.turn });
    endTurn(cls, game);
  }
}

function addScore(cls, id, pts, field) {
  const s = cls.students.get(id); if (!s) return;
  s.score += pts; if (field) s[field] = (s[field] || 0) + 1;
}

function reveal(cls, grp, idx, voters) {
  const game = grp.game;
  const card = game.cards[idx];
  const team = game.turn;
  card.revealed = true; card.by = team;
  const names = voters.map(v => (cls.students.get(v) || {}).name).filter(Boolean);
  const ev = { type: 'reveal', idx, id: card.id, color: card.color, team, by: names };
  const lg = game.log[game.log.length - 1]; if (lg) lg.picks.push({ ko: card.ko, color: card.color });
  game.votes = {}; game.passVotes = new Set();
  if (card.color === team) {
    voters.forEach(v => addScore(cls, v, PTS.hit, 'correct'));
    if (spyActive(cls, game, team) || cls.students.has(game.teams[team].spy)) addScore(cls, game.teams[team].spy, PTS.spyHit);
    game.guessesLeft--; game.guessed++;
    ev.result = 'hit';
    pushEvent(game, ev);
    if (left(game, team) === 0) return finish(cls, grp, team, 'all');
    if (game.guessesLeft <= 0) return endTurn(cls, game);
    game.aiAt = now() + 2500;
  } else if (card.color === 'assassin') {
    ev.result = 'assassin'; pushEvent(game, ev);
    return finish(cls, grp, other(team), 'assassin');
  } else if (card.color === other(team)) {
    ev.result = 'enemy'; pushEvent(game, ev);
    if (left(game, other(team)) === 0) return finish(cls, grp, other(team), 'all');
    return endTurn(cls, game);
  } else {
    ev.result = 'neutral'; pushEvent(game, ev);
    return endTurn(cls, game);
  }
}

function endTurn(cls, game) {
  game.turn = other(game.turn);
  game.hint = null;
  startPhase(cls, game, 'hint');
  pushEvent(game, { type: 'turn', team: game.turn });
}

function finish(cls, grp, winner, reason) {
  const game = grp.game;
  game.phase = 'over'; game.winner = winner; game.reason = reason; game.deadline = null;
  game.nextAt = now() + 15000;
  ['red', 'blue'].forEach(t => {
    const tm = game.teams[t];
    const ids = [...tm.members, tm.spy].filter(id => cls.students.has(id));
    ids.forEach(id => {
      addScore(cls, id, PTS.play, 'games');
      if (t === winner) addScore(cls, id, PTS.win, 'wins');
    });
  });
  pushEvent(game, { type: 'over', team: winner, reason });
}

// ---------- AI (힌트 담당이 없거나 시간이 지났을 때) ----------
function aiHint(cls, game) {
  const unit = UNITS[game.unit];
  const t = game.turn;
  const open = game.cards.filter(c => !c.revealed);
  let best = null;
  shuffle(unit.hints).forEach(h => {
    const mine = open.filter(c => c.color === t && c.tags.includes(h.w)).length;
    if (!mine) return;
    const bad = open.filter(c => c.color === other(t) && c.tags.includes(h.w)).length;
    const neu = open.filter(c => c.color === 'neutral' && c.tags.includes(h.w)).length;
    const ass = open.some(c => c.color === 'assassin' && c.tags.includes(h.w));
    if (ass) return;
    const used = game.hintsUsed.some(u => u.word === h.w) ? 3 : 0;
    const score = Math.min(mine, 3) * 10 - bad * 7 - neu * 4 - used;
    if (!best || score > best.score) best = { w: h.w, num: Math.min(mine, 3), score };
  });
  if (!best) { // 그래도 없으면 우리 카드 하나만 가리키는 단어
    const mineCard = open.find(c => c.color === t);
    best = { w: (mineCard && mineCard.tags[0]) || unit.hints[0].w, num: 1 };
  }
  giveHint(cls, game, t, best.w, best.num, true);
}

function aiGuess(cls, grp) {
  const game = grp.game; const t = game.turn;
  if (game.guessed >= game.hint.num) { pushEvent(game, { type: 'pass', team: t }); return endTurn(cls, game); }
  const open = game.cards.map((c, i) => ({ c, i })).filter(o => !o.c.revealed);
  const good = open.filter(o => o.c.color === t && o.c.tags.includes(game.hint.word));
  let pick;
  if (good.length && Math.random() < 0.85) pick = good[0];
  else pick = shuffle(open.filter(o => o.c.color !== 'assassin'))[0] || open[0];
  reveal(cls, grp, pick.i, []);
}

// ---------- 주기적으로 시간·AI 처리 ----------
setInterval(() => {
  classes.forEach(cls => {
    let changed = false;
    cls.groups.forEach(grp => {
      const game = grp.game; if (!game) return;
      const t = now();
      if (game.phase === 'hint') {
        if ((!spyActive(cls, game, game.turn) && t >= game.aiAt) || (game.deadline && t >= game.deadline)) { aiHint(cls, game); changed = true; }
      } else if (game.phase === 'guess') {
        if (!humanAgents(cls, game, game.turn).length && t >= game.aiAt) { aiGuess(cls, grp); changed = true; }
        else if (game.deadline && t >= game.deadline) { pushEvent(game, { type: 'timeout', team: game.turn }); endTurn(cls, game); changed = true; }
      } else if (game.phase === 'over') {
        if (cls.state === 'playing' && cls.settings.autoNext && t >= game.nextAt) { newGame(cls, grp); changed = true; }
      }
    });
    if (changed) pushClass(cls);
  });
  // 6시간 넘게 쓰지 않은 교실 정리
  classes.forEach((cls, code) => { if (now() - cls.lastActive > 6 * 3600e3) classes.delete(code); });
}, 500);

// ---------- 화면에 보낼 정보 ----------
function ranking(cls) {
  const arr = [...cls.students.values()].map(s => ({ id: s.id, name: s.name, score: s.score, wins: s.wins || 0, games: s.games || 0, correct: s.correct || 0, connected: s.connected }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
  let r = 0, prev = null;
  arr.forEach((s, i) => { if (s.score !== prev) { r = i + 1; prev = s.score; } s.rank = r; });
  return arr;
}

function person(cls, id) {
  if (id === 'AI') return { ai: true, name: 'AI 요원' };
  const s = cls.students.get(id);
  return s ? { id, name: s.name, connected: s.connected } : { id, name: '?', connected: false };
}

function gameView(cls, grp, viewer) {
  const game = grp.game; if (!game) return null;
  const unit = UNITS[game.unit];
  const me = viewer === 'teacher' ? { team: null, role: 'teacher' } : (teamOf(game, viewer) || { team: null, role: 'watch' });
  const seeAll = viewer === 'teacher' || me.role === 'spy' || game.phase === 'over';
  const assets = assetMap();
  const view = {
    no: game.no, group: grp.name, phase: game.phase, turn: game.turn, start: game.start,
    hint: game.hint ? { ...game.hint, ko: (unit.hints.find(h => h.w === game.hint.word) || {}).ko } : null,
    guessesLeft: game.guessesLeft, guessed: game.guessed,
    remain: game.deadline ? Math.max(0, game.deadline - now()) : null,
    nextIn: game.phase === 'over' && cls.state === 'playing' && cls.settings.autoNext ? Math.max(0, game.nextAt - now()) : null,
    winner: game.winner, reason: game.reason,
    left: { red: left(game, 'red'), blue: left(game, 'blue') },
    total: { red: game.cards.filter(c => c.color === 'red').length, blue: game.cards.filter(c => c.color === 'blue').length },
    teams: {},
    me: { ...me },
    need: game.phase === 'guess' ? needVotes(cls, game, game.turn) : 0,
    passVotes: [...game.passVotes].map(id => person(cls, id).name),
    showHintKo: cls.settings.showHintKo,
    events: game.events,
    cards: game.cards.map((c, i) => ({
      i, id: c.id, en: c.en, ko: c.ko, img: assets.cards[c.id], q: `Do you know about ${c.en}?`, a: c.a,
      revealed: c.revealed, by: c.by,
      color: (c.revealed || seeAll) ? c.color : null,
      tags: me.role === 'spy' || viewer === 'teacher' ? c.tags : undefined,
      votes: (game.votes[i] ? [...game.votes[i]] : []).map(id => person(cls, id).name)
    }))
  };
  ['red', 'blue'].forEach(t => { view.teams[t] = { spy: person(cls, game.teams[t].spy), members: game.teams[t].members.map(id => person(cls, id)) }; });
  if (me.role === 'spy') view.hints = unit.hints;
  return view;
}

function planView(cls, grp) {
  if (grp.game) return null;
  const p = ensurePlan(cls, grp);
  const v = {}; ['red', 'blue'].forEach(t => { v[t] = { spy: person(cls, p[t].spy), members: p[t].members.map(id => person(cls, id)) }; });
  return v;
}
function studentState(cls, s) {
  const rk = ranking(cls);
  const mine = rk.find(r => r.id === s.id) || {};
  const grp = groupOf(cls, s.gid);
  return {
    code: cls.code, classState: cls.state,
    me: { id: s.id, name: s.name, score: s.score, rank: mine.rank, total: rk.length, wins: s.wins || 0, games: s.games || 0, correct: s.correct || 0 },
    group: grp ? { name: grp.name, members: grp.members.map(id => person(cls, id)), plan: planView(cls, grp) } : null,
    game: grp && grp.game ? gameView(cls, grp, s.id) : null,
    ranking: cls.state === 'ended' ? rk.slice(0, 30) : rk.slice(0, 5),
    unitTitle: (UNITS[cls.settings.unit] || {}).title
  };
}

function teacherState(cls) {
  return {
    code: cls.code, token: cls.token, state: cls.state, settings: cls.settings,
    units: Object.entries(UNITS).map(([k, u]) => ({ key: k, title: u.title })),
    students: [...cls.students.values()].map(s => ({ id: s.id, name: s.name, connected: s.connected, score: s.score, group: (groupOf(cls, s.gid) || {}).name || null })),
    groups: cls.groups.map(g => ({ gid: g.gid, name: g.name, members: g.members.map(id => person(cls, id)), game: g.game ? { ...gameView(cls, g, 'teacher'), log: g.game.log.slice(-6).reverse(), elapsed: now() - g.game.startedAt } : null })),
    ranking: ranking(cls)
  };
}

let pushTimers = new Map();
function pushClass(cls) {
  if (pushTimers.has(cls.code)) return;
  pushTimers.set(cls.code, setTimeout(() => {
    pushTimers.delete(cls.code);
    cls.students.forEach(s => { if (s.socketId) io.to(s.socketId).emit('state', studentState(cls, s)); });
    if (cls.teacherSocket) io.to(cls.teacherSocket).emit('tstate', teacherState(cls));
  }, 30));
}

// ---------- 소켓 ----------
io.on('connection', socket => {
  let my = { kind: null, code: null, sid: null };
  const cls = () => classes.get(my.code);
  const touch = c => { if (c) c.lastActive = now(); };

  // ----- 교사 -----
  socket.on('teacher:create', (_, cb) => {
    const c = createClass();
    c.teacherSocket = socket.id; my = { kind: 'teacher', code: c.code };
    cb && cb({ ok: true, code: c.code, token: c.token });
    pushClass(c);
  });
  socket.on('teacher:resume', ({ code, token } = {}, cb) => {
    const c = classes.get(String(code));
    if (!c || c.token !== token) return cb && cb({ ok: false });
    c.teacherSocket = socket.id; my = { kind: 'teacher', code: c.code }; touch(c);
    cb && cb({ ok: true, code: c.code, token: c.token });
    pushClass(c);
  });
  const T = (ev, fn) => socket.on(ev, (data, cb) => {
    const c = cls(); if (!c || my.kind !== 'teacher' || c.teacherSocket !== socket.id) return cb && cb({ ok: false });
    touch(c); fn(c, data || {}); pushClass(c); cb && cb({ ok: true });
  });
  T('teacher:settings', (c, d) => {
    if (d.groupSize) c.settings.groupSize = Math.max(2, Math.min(8, +d.groupSize));
    if (d.turnTime !== undefined) c.settings.turnTime = [0, 60, 90, 120, 180].includes(+d.turnTime) ? +d.turnTime : 90;
    if (d.showHintKo !== undefined) c.settings.showHintKo = !!d.showHintKo;
    if (d.autoNext !== undefined) c.settings.autoNext = !!d.autoNext;
    if (d.unit && UNITS[d.unit]) c.settings.unit = d.unit;
  });
  T('teacher:assign', c => {
    assignGroups(c);
    if (c.state === 'playing') c.groups.forEach(g => newGame(c, g));
    else c.state = 'lobby';
  });
  T('teacher:startAll', c => {
    if (!c.groups.length) assignGroups(c);
    c.state = 'playing';
    c.groups.forEach(g => newGame(c, g));
  });
  T('teacher:nextAll', c => { if (c.state === 'playing') c.groups.forEach(g => newGame(c, g)); });
  T('teacher:endAll', c => {
    c.state = 'ended';
    c.groups.forEach(g => { if (g.game && g.game.phase !== 'over') { g.game.phase = 'over'; g.game.winner = null; g.game.reason = 'stop'; } });
  });
  T('teacher:lobby', c => { c.state = 'lobby'; c.groups.forEach(g => (g.game = null)); });
  T('teacher:resetRank', c => { c.students.forEach(s => { s.score = 0; s.wins = 0; s.games = 0; s.correct = 0; }); });
  T('teacher:kick', (c, d) => {
    const s = c.students.get(d.id); if (!s) return;
    removeFromGroup(c, s); c.students.delete(s.id);
    if (s.socketId) io.to(s.socketId).emit('kicked');
  });

  // ----- 학생 -----
  socket.on('student:check', ({ code } = {}, cb) => {
    cb && cb(classes.has(String(code || '').trim()) ? { ok: true } : { ok: false, err: '교실 코드를 찾을 수 없어요.' });
  });
  socket.on('student:join', ({ code, name, sid } = {}, cb) => {
    const c = classes.get(String(code || '').trim());
    if (!c) return cb && cb({ ok: false, err: '교실 코드를 찾을 수 없어요.' });
    name = String(name || '').trim().slice(0, 10);
    let s = sid && c.students.get(sid);
    if (!s) {
      if (!name) return cb && cb({ ok: false, err: '이름을 입력해 주세요.' });
      const same = [...c.students.values()].find(x => x.name === name);
      if (same && same.connected) return cb && cb({ ok: false, err: '같은 이름이 이미 있어요. 번호를 붙여 주세요. (예: 민수3)' });
      if (same) s = same; // 같은 이름으로 다시 들어온 경우 이어하기
      else {
        s = { id: rid(10), name, score: 0, wins: 0, games: 0, correct: 0, spyCount: 0, gid: null, connected: true, socketId: null };
        c.students.set(s.id, s);
        if (c.groups.length) addLateStudent(c, s);
      }
    }
    s.connected = true; s.socketId = socket.id;
    my = { kind: 'student', code: c.code, sid: s.id }; touch(c);
    cb && cb({ ok: true, sid: s.id, code: c.code, name: s.name });
    pushClass(c);
  });

  const S = (ev, fn) => socket.on(ev, data => {
    const c = cls(); if (!c || my.kind !== 'student') return;
    const s = c.students.get(my.sid); if (!s) return;
    const grp = groupOf(c, s.gid); if (!grp || !grp.game) return;
    touch(c); fn(c, grp, s, data || {}); pushClass(c);
  });
  S('game:hint', (c, grp, s, d) => {
    const tr = teamOf(grp.game, s.id);
    if (tr && tr.role === 'spy') giveHint(c, grp.game, tr.team, d.word, d.num, false);
  });
  S('game:vote', (c, grp, s, d) => vote(c, grp, s.id, +d.idx));
  S('game:pass', (c, grp, s) => passVote(c, grp, s.id));

  socket.on('disconnect', () => {
    const c = cls(); if (!c) return;
    if (my.kind === 'teacher' && c.teacherSocket === socket.id) c.teacherSocket = null;
    if (my.kind === 'student') {
      const s = c.students.get(my.sid);
      if (s && s.socketId === socket.id) {
        s.connected = false; s.socketId = null;
        const grp = groupOf(c, s.gid); if (grp && grp.game) { clearVotes(grp.game, s.id); grp.game.aiAt = now() + 4000; }
      }
    }
    pushClass(c);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CODE K 서버 실행 중: http://localhost:${PORT}`));
