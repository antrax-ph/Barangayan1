const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './game.db';
const SECRET = process.env.SECRET || 'change-me-' + crypto.randomBytes(8).toString('hex');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL,
  pera REAL NOT NULL DEFAULT 500, energiya REAL NOT NULL DEFAULT 500, galing INTEGER NOT NULL DEFAULT 0,
  last_tick INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL, type TEXT NOT NULL,
  x INTEGER NOT NULL, y INTEGER NOT NULL, level INTEGER NOT NULL DEFAULT 1, built_at INTEGER NOT NULL,
  upgrade_ready_at INTEGER DEFAULT 0, FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS troops (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL, type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_troops ON troops(player_id, type);
CREATE TABLE IF NOT EXISTS train_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id INTEGER NOT NULL, type TEXT NOT NULL,
  ready_at INTEGER NOT NULL, FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS raid_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, attacker_id INTEGER NOT NULL, defender_id INTEGER NOT NULL,
  result TEXT NOT NULL, loot_pera INTEGER NOT NULL DEFAULT 0, loot_energiya INTEGER NOT NULL DEFAULT 0, ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, multiplier REAL DEFAULT 1, ends_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, tag TEXT NOT NULL, description TEXT, created INTEGER
);
CREATE TABLE IF NOT EXISTS clan_members (
  clan_id INTEGER, player_id INTEGER, role TEXT DEFAULT 'member', PRIMARY KEY(clan_id, player_id)
);
`);

try { db.exec("ALTER TABLE players ADD COLUMN kristal INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE players ADD COLUMN skins TEXT DEFAULT '{}'"); } catch(e){}
try { db.exec("ALTER TABLE players ADD COLUMN xp INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE players ADD COLUMN clan_id INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE players ADD COLUMN achievements TEXT DEFAULT '[]'"); } catch(e){}

const ADMIN_USER = 'Antrax';
const ADMIN_PASS = 'antraxadmingod';
const MAX_LEVEL = 10;

const BUILDINGS = {
  barangay_hall:    { name: 'Barangay Hall', size: 4, hp: 2000, basePera: 0, baseEnergiya: 0, buildTime: 0, cat: 'core' },
  sarisari_store:   { name: 'Sari-Sari Store', size: 3, hp: 400, basePera: 150, buildTime: 15000, rate: 3, cat: 'res' },
  kalamansi_farm:   { name: 'Kalamansi Farm', size: 3, hp: 400, baseEnergiya: 150, buildTime: 15000, rate: 3, cat: 'res' },
  ginto_mine:       { name: 'Ginto Mine', size: 3, hp: 600, basePera: 300, buildTime: 30000, rate: 5, cat: 'res' },
  enerhiya_pump:    { name: 'Enerhiya Pump', size: 3, hp: 600, baseEnergiya: 300, buildTime: 30000, rate: 5, cat: 'res' },
  jeepney_terminal: { name: 'Jeepney Terminal', size: 3, hp: 500, basePera: 200, buildTime: 30000, cat: 'army' },
  balangay:         { name: 'Balangay', size: 4, hp: 300, basePera: 100, baseEnergiya: 100, buildTime: 20000, cat: 'army' },
  laboratory:       { name: 'Laboratory', size: 3, hp: 500, basePera: 500, baseEnergiya: 500, buildTime: 60000, cat: 'army' },
  spell_factory:    { name: 'Spell Factory', size: 3, hp: 400, basePera: 400, baseEnergiya: 400, buildTime: 50000, cat: 'army' },
  lantaka:          { name: 'Lantaka', size: 2, hp: 600, basePera: 300, buildTime: 40000, dmg: 40, range: 5, cat: 'def' },
  bantay_tower:     { name: 'Bantay Tower', size: 2, hp: 500, basePera: 400, baseEnergiya: 100, buildTime: 60000, dmg: 30, range: 7, cat: 'def' },
  mortar:           { name: 'Mortar', size: 2, hp: 400, basePera: 400, buildTime: 50000, dmg: 60, range: 9, splash: true, cat: 'def' },
  air_defense:      { name: 'Air Defense', size: 2, hp: 800, basePera: 800, buildTime: 80000, dmg: 80, range: 10, targetsAir: true, cat: 'def' },
  bakod:            { name: 'Bakod', size: 1, hp: 500, basePera: 50, buildTime: 2000, cat: 'def' },
  kubo:             { name: 'Kubo', size: 1, hp: 100, basePera: 20, buildTime: 2000, cat: 'deco' },
  puno:             { name: 'Puno', size: 1, hp: 10, basePera: 10, buildTime: 1000, cat: 'deco' },
  bato:             { name: 'Bato', size: 1, hp: 10, basePera: 10, buildTime: 1000, cat: 'deco' },
};

const TROOPS = {
  mandirigma: { name: 'Mandirigma', cost: 25, time: 8000, housing: 1, dmg: 20 },
  mangangaso: { name: 'Mangangaso', cost: 50, time: 12000, housing: 1, dmg: 15, ranged: 4 },
  higante:    { name: 'Higante', cost: 150, time: 30000, housing: 5, dmg: 40, targetsDefense: true },
  albularyo:  { name: 'Albularyo', cost: 80, time: 15000, housing: 1, dmg: 5, heal: 20 },
  mambubuno:  { name: 'Mambubuno', cost: 60, time: 10000, housing: 1, dmg: 100, targetsWalls: true },
  kabalyero:  { name: 'Kabalyero', cost: 120, time: 20000, housing: 2, dmg: 50, jumpsWalls: true },
  dragon:     { name: 'Dragon', cost: 300, time: 45000, housing: 10, dmg: 80, flying: true },
  babaylan:   { name: 'Babaylan', cost: 100, time: 18000, housing: 2, dmg: 30, splash: true, ranged: 5 },
};

const HEROES = {
  lapulapu: { name: 'Lapu-Lapu', cost: 0, time: 0, hp: 2000, dmg: 150, speed: 1.2, range: 2 },
  gabriela: { name: 'Gabriela', cost: 0, time: 0, hp: 1500, dmg: 200, speed: 1.3, range: 5 },
};

const RES_RATE = 3;
const MAX_OFFLINE_SEC = 8 * 3600;

function getUpgradeCost(type, lvl) {
  const cfg = BUILDINGS[type]; if (!cfg) return { pera: 0, energiya: 0, time: 0 };
  const mult = Math.pow(1.6, lvl - 1);
  return { pera: Math.floor((cfg.basePera || 100) * mult), energiya: Math.floor((cfg.baseEnergiya || 0) * mult), time: Math.floor((cfg.buildTime || 10000) * mult) };
}
function getMaxStorage(id) {
  const th = db.prepare("SELECT level FROM buildings WHERE player_id = ? AND type = 'barangay_hall'").get(id);
  return (th?.level || 1) * 2500;
}
function hashPw(pw, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex'); }
function checkPw(pw, stored) { const [salt, h] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(crypto.scryptSync(pw, salt, 64).toString('hex'), 'hex')); }
function signToken(p) { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); }
function verifyToken(t) {
  if (!t) return null; const [b, s] = t.split('.'); if (!b || !s) return null;
  const e = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (Buffer.byteLength(s) !== Buffer.byteLength(e) || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; }
}
function authMw(req, res, next) { const p = verifyToken(req.headers.authorization?.replace('Bearer ', '')); if (!p || p.admin) return res.status(401).json({ error: 'auth' }); req.playerId = p.id; next(); }
function adminMw(req, res, next) { const p = verifyToken(req.headers.authorization?.replace('Bearer ', '')); if (!p || !p.admin) return res.status(401).json({ error: 'admin only' }); next(); }

function tickPlayer(id) {
  const p = db.prepare('SELECT * FROM players WHERE id = ?').get(id); if (!p) return null;
  const now = Date.now();
  for (const b of db.prepare('SELECT id FROM buildings WHERE player_id = ? AND upgrade_ready_at > 0 AND upgrade_ready_at <= ?').all(id, now)) {
    db.prepare('UPDATE buildings SET level = level + 1, upgrade_ready_at = 0 WHERE id = ?').run(b.id);
  }
  const elapsed = Math.min((now - (p.last_tick || now)) / 1000, MAX_OFFLINE_SEC);
  if (elapsed <= 0) { db.prepare('UPDATE players SET last_tick = ? WHERE id = ?').run(now, id); return db.prepare('SELECT * FROM players WHERE id = ?').get(id); }
  
  const stores = db.prepare("SELECT SUM(level) c FROM buildings WHERE player_id = ? AND type IN ('sarisari_store','ginto_mine')").get(id).c || 0;
  const farms  = db.prepare("SELECT SUM(level) c FROM buildings WHERE player_id = ? AND type IN ('kalamansi_farm','enerhiya_pump')").get(id).c || 0;
  const maxStor = getMaxStorage(id);
  const boost = db.prepare("SELECT multiplier FROM game_events WHERE type = 'boost' AND ends_at > ?").get(now);
  const mult = boost ? boost.multiplier : 1;

  const peraGain = Math.min(stores * RES_RATE * elapsed * mult, Math.max(0, maxStor - p.pera));
  const energiyaGain = Math.min(farms * RES_RATE * elapsed * mult, Math.max(0, maxStor - p.energiya));
  db.prepare('UPDATE players SET pera = pera + ?, energiya = energiya + ?, last_tick = ? WHERE id = ?').run(peraGain, energiyaGain, now, id);

  for (const r of db.prepare('SELECT * FROM train_queue WHERE player_id = ? AND ready_at <= ?').all(id, now)) {
    db.prepare(`INSERT INTO troops (player_id, type, count) VALUES (?, ?, 1) ON CONFLICT(player_id, type) DO UPDATE SET count = count + 1`).run(id, r.type);
    db.prepare('DELETE FROM train_queue WHERE id = ?').run(r.id);
  }
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

function publicState(id) {
  const p = tickPlayer(id); if (!p) return null;
  return {
    id: p.id, username: p.username, pera: Math.floor(p.pera), energiya: Math.floor(p.energiya), galing: p.galing, kristal: p.kristal || 0, xp: p.xp || 0, clan_id: p.clan_id || 0,
    skins: JSON.parse(p.skins || '{}'), achievements: JSON.parse(p.achievements || '[]'),
    buildings: db.prepare('SELECT * FROM buildings WHERE player_id = ?').all(id),
    troops: db.prepare('SELECT type, count FROM troops WHERE player_id = ?').all(id),
    queue: db.prepare('SELECT id, type, ready_at FROM train_queue WHERE player_id = ? ORDER BY ready_at').all(id),
    maxStorage: getMaxStorage(id), config: { BUILDINGS, TROOPS, HEROES, RES_RATE, MAX_LEVEL }, serverNow: Date.now(),
  };
}

const app = express(); app.use(express.json()); app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// AUTH
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.length < 3) return res.status(400).json({ error: 'invalid input' });
  try {
    const now = Date.now();
    const id = db.prepare('INSERT INTO players (username, pw_hash, last_tick, created) VALUES (?, ?, ?, ?)').run(username, hashPw(password), now, now).lastInsertRowid;
    const start = [ ['barangay_hall', 13, 13], ['sarisari_store', 10, 13], ['sarisari_store', 17, 13], ['kalamansi_farm', 13, 10], ['kalamansi_farm', 13, 17], ['jeepney_terminal', 8, 8], ['balangay', 18, 18] ];
    const stmt = db.prepare('INSERT INTO buildings (player_id, type, x, y, level, built_at) VALUES (?, ?, ?, ?, 1, ?)');
    for (const [t, x, y] of start) stmt.run(id, t, x, y, now);
    res.json({ token: signToken({ id, u: username }), state: publicState(id) });
  } catch (e) { res.status(409).json({ error: 'username taken' }); }
});
app.post('/api/login', (req, res) => {
  const p = db.prepare('SELECT * FROM players WHERE username = ?').get(req.body?.username);
  if (!p || !checkPw(req.body?.password, p.pw_hash)) return res.status(401).json({ error: 'bad creds' });
  res.json({ token: signToken({ id: p.id, u: p.username }), state: publicState(p.id) });
});
app.get('/api/state', authMw, (req, res) => res.json(publicState(req.playerId)));

// BUILDINGS
app.post('/api/build', authMw, (req, res) => {
  const { type, x, y } = req.body || {}; const cfg = BUILDINGS[type]; if (!cfg) return res.status(400).json({ error: 'unknown' });
  const p = tickPlayer(req.playerId);
  const existing = db.prepare('SELECT * FROM buildings WHERE player_id = ?').all(req.playerId);
  for (const b of existing) {
    const bs = BUILDINGS[b.type].size;
    if (x < b.x + bs && x + cfg.size > b.x && y < b.y + bs && y + cfg.size > b.y) return res.status(400).json({ error: 'overlap' });
  }
  if (x < 0 || y < 0 || x + cfg.size > 32 || y + cfg.size > 32) return res.status(400).json({ error: 'out of bounds' });
  const c = getUpgradeCost(type, 1);
  if (c.pera > p.pera || c.energiya > p.energiya) return res.status(400).json({ error: 'cost' });
  db.prepare('UPDATE players SET pera = pera - ?, energiya = energiya - ? WHERE id = ?').run(c.pera, c.energiya, req.playerId);
  db.prepare('INSERT INTO buildings (player_id, type, x, y, level, built_at) VALUES (?, ?, ?, ?, 1, ?)').run(req.playerId, type, x, y, Date.now());
  res.json(publicState(req.playerId));
});
app.post('/api/upgrade', authMw, (req, res) => {
  const b = db.prepare('SELECT * FROM buildings WHERE id = ? AND player_id = ?').get(req.body?.id, req.playerId);
  if (!b) return res.status(404).json({ error: 'not found' });
  if (b.level >= MAX_LEVEL) return res.status(400).json({ error: 'max level' });
  if (b.upgrade_ready_at > 0) return res.status(400).json({ error: 'already upgrading' });
  const p = tickPlayer(req.playerId); const c = getUpgradeCost(b.type, b.level + 1);
  if (c.pera > p.pera || c.energiya > p.energiya) return res.status(400).json({ error: 'cost' });
  db.prepare('UPDATE players SET pera = pera - ?, energiya = energiya - ? WHERE id = ?').run(c.pera, c.energiya, req.playerId);
  db.prepare('UPDATE buildings SET upgrade_ready_at = ? WHERE id = ?').run(Date.now() + c.time, b.id);
  res.json(publicState(req.playerId));
});

// TROOPS
app.post('/api/train', authMw, (req, res) => {
  const cfg = TROOPS[req.body?.type]; if (!cfg) return res.status(400).json({ error: 'unknown' });
  const p = tickPlayer(req.playerId);
  if (p.energiya < cfg.cost) return res.status(400).json({ error: 'cost' });
  const cap = (db.prepare("SELECT SUM(level) c FROM buildings WHERE player_id = ? AND type = 'balangay'").get(req.playerId).c || 0) * 10;
  const housing = db.prepare("SELECT SUM(count * CASE type WHEN 'higante' THEN 5 WHEN 'dragon' THEN 10 ELSE 1 END) c FROM troops WHERE player_id = ?").get(req.playerId).c || 0;
  if (housing + cfg.housing > cap) return res.status(400).json({ error: 'camp full' });
  db.prepare('UPDATE players SET energiya = energiya - ? WHERE id = ?').run(cfg.cost, req.playerId);
  db.prepare('INSERT INTO train_queue (player_id, type, ready_at) VALUES (?, ?, ?)').run(req.playerId, req.body.type, Date.now() + cfg.time);
  res.json(publicState(req.playerId));
});

// RAIDS & CAMPAIGN
function genProcBase(level = 1) {
  const b = [{ type: 'barangay_hall', x: 13, y: 13, level: level, id: -1 }];
  const defenses = ['lantaka', 'mortar', 'air_defense'];
  for (let i = 0; i < level + 2; i++) {
    b.push({ type: defenses[i % 3], x: 10 + (i*2)%10, y: 10 + (i*3)%10, level: level, id: -10-i });
  }
  return b;
}
app.get('/api/raid/find', authMw, (req, res) => {
  const others = db.prepare('SELECT id, username, galing FROM players WHERE id != ? ORDER BY ABS(galing - ?) ASC LIMIT 5').all(req.playerId, db.prepare('SELECT galing FROM players WHERE id = ?').get(req.playerId)?.galing || 0);
  if (!others.length) return res.json({ procedural: true, target: { id: -1, username: 'NPC Raider', galing: 0, buildings: genProcBase(2), pera: 500, energiya: 500 } });
  const t = others[Math.floor(Math.random() * others.length)];
  const tp = db.prepare('SELECT pera, energiya FROM players WHERE id = ?').get(t.id);
  res.json({ procedural: false, target: { ...t, buildings: db.prepare('SELECT * FROM buildings WHERE player_id = ?').all(t.id), pera: Math.min(tp.pera, 800), energiya: Math.min(tp.energiya, 800) } });
});
app.get('/api/campaign/find', authMw, (req, res) => {
  const lvl = Math.floor(Math.random() * 5) + 2;
  res.json({ target: { id: -2, username: `Campaign Lv${lvl}`, galing: lvl * 20, buildings: genProcBase(lvl), pera: lvl * 200, energiya: lvl * 200 } });
});

app.post('/api/raid/attack', authMw, (req, res) => {
  const { targetId, troops, isCampaign } = req.body || {}; const p = tickPlayer(req.playerId);
  const deployed = {}; let housing = 0;
  for (const [t, c] of Object.entries(troops || {})) {
    const cfg = TROOPS[t]; if (!cfg) continue;
    const use = Math.min(c, db.prepare('SELECT count FROM troops WHERE player_id = ? AND type = ?').get(req.playerId, t)?.count || 0);
    if (use > 0) { deployed[t] = use; housing += use * cfg.housing; }
  }
  if (!housing) return res.status(400).json({ error: 'no troops' });
  const tb = targetId === -1 ? genProcBase(2) : (isCampaign ? genProcBase(5) : db.prepare('SELECT * FROM buildings WHERE player_id = ?').all(targetId));
  let dHp = 0; let hasAirDef = false; let hasMortar = false;
  for (const b of tb) { dHp += (BUILDINGS[b.type]?.hp || 100) * (b.level || 1); if (b.type === 'air_defense') hasAirDef = true; if (b.type === 'mortar') hasMortar = true; }
  let aPower = 0;
  for (const [t, c] of Object.entries(deployed)) {
    const cfg = TROOPS[t];
    let dmg = cfg.dmg * c;
    if (cfg.targetsDefense) dmg *= 2; if (cfg.splash) dmg *= 1.5;
    if (cfg.flying && hasAirDef) dmg *= 0.5; if (!cfg.flying && hasMortar) dmg *= 0.8;
    aPower += dmg;
  }
  const win = aPower > dHp * 0.6; const ratio = Math.min(1, aPower / Math.max(1, dHp));
  let lP = Math.floor(500 * ratio), lE = Math.floor(500 * ratio);
  for (const [t, c] of Object.entries(deployed)) db.prepare('UPDATE troops SET count = MAX(0, count - ?) WHERE player_id = ? AND type = ?').run(c, req.playerId, t);
  const gD = win ? 30 : -15; const xpGain = win ? (isCampaign ? 100 : 50) : 10;
  db.prepare('UPDATE players SET pera = pera + ?, energiya = energiya + ?, galing = MAX(0, galing + ?), xp = xp + ? WHERE id = ?').run(lP, lE, gD, xpGain, req.playerId);
  if (!isCampaign && targetId !== -1) db.prepare('UPDATE players SET galing = MAX(0, galing - ?) WHERE id = ?').run(win ? 30 : 0, targetId);
  res.json({ win, lootPera: lP, lootEnergiya: lE, galingDelta: gD, state: publicState(req.playerId) });
});

// CLANS
app.post('/api/clan/create', authMw, (req, res) => {
  const { name, tag } = req.body;
  try {
    const id = db.prepare('INSERT INTO clans (name, tag, created) VALUES (?, ?, ?)').run(name, tag, Date.now()).lastInsertRowid;
    db.prepare('INSERT INTO clan_members (clan_id, player_id, role) VALUES (?, ?, ?)').run(id, req.playerId, 'leader');
    db.prepare('UPDATE players SET clan_id = ? WHERE id = ?').run(id, req.playerId);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: 'Name taken' }); }
});
app.get('/api/clan/list', authMw, (req, res) => {
  res.json(db.prepare('SELECT c.*, COUNT(m.player_id) as members FROM clans c LEFT JOIN clan_members m ON c.id = m.clan_id GROUP BY c.id').all());
});
app.post('/api/clan/join', authMw, (req, res) => {
  const { clanId } = req.body;
  db.prepare('INSERT OR IGNORE INTO clan_members (clan_id, player_id) VALUES (?, ?)').run(clanId, req.playerId);
  db.prepare('UPDATE players SET clan_id = ? WHERE id = ?').run(clanId, req.playerId);
  res.json(publicState(req.playerId));
});

// ADMIN
app.post('/api/admin/login', (req, res) => {
  if (req.body?.username === ADMIN_USER && req.body?.password === ADMIN_PASS) res.json({ token: signToken({ admin: true }) });
  else res.status(401).json({ error: 'bad creds' });
});
app.post('/api/admin/give', adminMw, (req, res) => {
  const { username, pera, energiya, galing, kristal, xp } = req.body || {};
  const p = db.prepare('SELECT id FROM players WHERE username = ?').get(username);
  if (!p) return res.status(404).json({ error: 'player not found' });
  db.prepare('UPDATE players SET pera = pera + ?, energiya = energiya + ?, galing = galing + ?, kristal = kristal + ?, xp = xp + ? WHERE id = ?').run(pera||0, energiya||0, galing||0, kristal||0, xp||0, p.id);
  res.json({ ok: true });
});
app.post('/api/admin/announce', adminMw, (req, res) => {
  db.prepare('INSERT INTO announcements (message, ts) VALUES (?, ?)').run(req.body.message, Date.now());
  for (const c of wss.clients) c.send(JSON.stringify({ type: 'announce', message: req.body.message }));
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const p = verifyToken(new URL(req.url, 'http://x').searchParams.get('token'));
  if (!p || p.admin) return ws.close();
  ws.playerId = p.id;
  ws.on('message', (msg) => {
    const d = JSON.parse(msg);
    if (d.type === 'chat') {
      const u = db.prepare('SELECT username FROM players WHERE id = ?').get(ws.playerId);
      const payload = JSON.stringify({ type: 'chat', user: u.username, message: d.message });
      for (const c of wss.clients) if (c.readyState === 1) c.send(payload);
    }
  });
});
server.listen(PORT, () => console.log(`🇵🇭 Barangay Clash 100x :${PORT}`));