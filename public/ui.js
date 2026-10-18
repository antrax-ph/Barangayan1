const BUILDING_TABS = {
  res: [ { type: 'sarisari_store', name: 'Sari-Sari', icon: '🏪' }, { type: 'kalamansi_farm', name: 'Kalamansi', icon: '🍋' }, { type: 'ginto_mine', name: 'Ginto Mine', icon: '🪙' }, { type: 'enerhiya_pump', name: 'Enerhiya', icon: '⚡' } ],
  army: [ { type: 'jeepney_terminal', name: 'Jeepney', icon: '🚌' }, { type: 'balangay', name: 'Balangay', icon: '⛵' }, { type: 'laboratory', name: 'Lab', icon: '🧪' }, { type: 'spell_factory', name: 'Spells', icon: '🔮' } ],
  def: [ { type: 'lantaka', name: 'Lantaka', icon: '💣' }, { type: 'bantay_tower', name: 'Bantay', icon: '🗼' }, { type: 'mortar', name: 'Mortar', icon: '🎇' }, { type: 'air_defense', name: 'Air Def', icon: '🚀' }, { type: 'bakod', name: 'Bakod', icon: '🎋' } ],
  deco: [ { type: 'kubo', name: 'Kubo', icon: '🛖' }, { type: 'puno', name: 'Puno', icon: '🌳' }, { type: 'bato', name: 'Bato', icon: '🪨' } ]
};
const TROOPS_UI = [
  { type: 'mandirigma', name: 'Mandirigma', icon: '🪓' }, { type: 'mangangaso', name: 'Mangangaso', icon: '🏹' }, { type: 'higante', name: 'Higante', icon: '🗿' },
  { type: 'albularyo', name: 'Albularyo', icon: '🧙' }, { type: 'mambubuno', name: 'Mambubuno', icon: '💣' }, { type: 'kabalyero', name: 'Kabalyero', icon: '🐎' },
  { type: 'dragon', name: 'Dragon', icon: '🐉' }, { type: 'babaylan', name: 'Babaylan', icon: '🔮' }
];
const SHOP_SKINS = [
  { id: 'golden', name: 'Ginto', color: '#ffcc00' }, { id: 'neon', name: 'Neon', color: '#00ffcc' }, { id: 'lava', name: 'Lava', color: '#ff3300' },
  { id: 'ice', name: 'Yelo', color: '#99ccff' }, { id: 'bamboo', name: 'Kawayan', color: '#336622' }
];

export class UI {
  constructor(state, net, renderer) {
    this.s = state; this.net = net; this.r = renderer; this.handlers = {}; this.activeTab = 'res';
    this.buildDom(); this.showAuth();
    setInterval(() => this.net.token && this.net.sync().catch(() => {}), 5000);
    setInterval(() => this.tickTimers(), 1000);
  }
  on(evt, fn) { this.handlers[evt] = fn; }
  emit(evt, d) { this.handlers[evt]?.(d); }

  buildDom() {
    const auth = document.createElement('div'); auth.id = 'auth'; auth.className = 'modal';
    auth.innerHTML = `<div class="modal-box"><h1>BARANGAY CLASH</h1><p class="tagline">100x ULTIMATE</p>
      <input id="u" placeholder="username" /><input id="p" type="password" placeholder="password" />
      <div class="row"><button id="loginBtn">Login</button><button id="regBtn" class="primary">Register</button></div>
      <p id="authErr" class="err"></p></div>`;
    document.body.appendChild(auth);

    const hud = document.createElement('div'); hud.id = 'hud'; hud.style.display = 'none';
    hud.innerHTML = `
      <div class="top">
        <div class="res pera"><span>₱</span><b id="pera">0</b></div>
        <div class="res energiya"><span>⚡</span><b id="energiya">0</b></div>
        <div class="res kristal"><span>💎</span><b id="kristal">0</b></div>
        <div class="res galing"><span>🏅</span><b id="galing">0</b></div>
        <div class="res xp"><span>⭐</span><b id="xp">0</b></div>
        <div class="spacer"></div>
        <button id="clanBtn">🛡️ Clan</button><button id="shopBtn">🛍️</button>
        <button id="campaignBtn">🗺️ Campaign</button><button id="raidBtn" class="primary">⚔ PINTAKASI</button>
      </div>
      <div class="bottom">
        <div class="tabs" id="buildTabs">
          <button class="tab active" data-tab="res">Resources</button><button class="tab" data-tab="army">Army</button>
          <button class="tab" data-tab="def">Defense</button><button class="tab" data-tab="deco">Deco</button>
        </div>
        <div class="build-menu" id="buildMenu"></div>
        <div class="troop-menu" id="troopMenu"></div>
      </div>
      <div class="selected-panel" id="selPanel" style="display:none"></div>
      <div class="toast" id="toast"></div>
      <div class="queue" id="queue"></div>
      <div class="chat-box"><div class="chat-log" id="chatLog"></div><div class="chat-input"><input id="chatInput" placeholder="Chat..." maxlength="50"/><button id="chatSend">➤</button></div></div>
      <div class="announce-banner" id="announceBanner"></div>
    `;
    document.body.appendChild(hud);

    // Modals
    const shop = document.createElement('div'); shop.id = 'shopModal'; shop.className = 'modal'; shop.style.display = 'none';
    shop.innerHTML = `<div class="modal-box"><h2>🛍️ Tindahan ng Skins</h2><select id="shopBuilding" style="width:100%;padding:10px;margin-bottom:12px;background:#0a0f14;color:#fff;border:1px solid #6a4a2a;border-radius:8px">${Object.keys(BUILDING_TABS.res).map(k => BUILDING_TABS.res[k]).flat().concat(BUILDING_TABS.army.flat()).concat(BUILDING_TABS.def.flat()).map(b => `<option value="${b.type}">${b.name}</option>`).join('')}</select><div id="skinList" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div><div class="row"><button id="closeShop">Close</button></div></div>`;
    document.body.appendChild(shop);

    const raid = document.createElement('div'); raid.id = 'raidModal'; raid.className = 'modal'; raid.style.display = 'none';
    raid.innerHTML = `<div class="modal-box wide"><h2>⚔ Pintakasi</h2><div id="raidContent"></div><div class="row"><button id="closeRaid">Close</button></div></div>`;
    document.body.appendChild(raid);

    const clan = document.createElement('div'); clan.id = 'clanModal'; clan.className = 'modal'; clan.style.display = 'none';
    clan.innerHTML = `<div class="modal-box wide"><h2>🛡️ Angkan (Clans)</h2><div id="clanContent"></div><div class="row"><button id="closeClan">Close</button></div></div>`;
    document.body.appendChild(clan);

    // Wiring
    document.getElementById('loginBtn').onclick = () => this.tryAuth('login');
    document.getElementById('regBtn').onclick = () => this.tryAuth('register');
    document.getElementById('raidBtn').onclick = () => this.openRaid();
    document.getElementById('closeRaid').onclick = () => document.getElementById('raidModal').style.display = 'none';
    document.getElementById('shopBtn').onclick = () => this.openShop();
    document.getElementById('closeShop').onclick = () => document.getElementById('shopModal').style.display = 'none';
    document.getElementById('shopBuilding').onchange = () => this.renderSkins();
    document.getElementById('clanBtn').onclick = () => this.openClan();
    document.getElementById('closeClan').onclick = () => document.getElementById('clanModal').style.display = 'none';
    document.getElementById('campaignBtn').onclick = () => this.emit('campaign');

    document.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => { document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); this.activeTab = t.dataset.tab; this.populateBuildMenu(); };
    });

    document.getElementById('chatSend').onclick = () => {
      const inp = document.getElementById('chatInput');
      if (inp.value.trim()) { this.net.sendChat(inp.value.trim()); inp.value = ''; }
    };
    document.getElementById('chatInput').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('chatSend').click(); };
  }

  openShop() { document.getElementById('shopModal').style.display = 'flex'; this.renderSkins(); }
  renderSkins() {
    const bType = document.getElementById('shopBuilding').value; const list = document.getElementById('skinList'); const equipped = this.s.player.skins[bType] || 'default';
    list.innerHTML = SHOP_SKINS.map(sk => `<div style="background:#1a1410;border:1px solid #6a4a2a;border-radius:8px;padding:10px;text-align:center"><div style="width:100%;height:30px;background:${sk.color};border-radius:4px;margin-bottom:8px"></div><div style="font-size:12px;margin-bottom:8px">${sk.name}</div>${equipped === sk.id ? `<button disabled style="width:100%;padding:4px;font-size:10px">Equipped</button>` : `<button class="primary" style="width:100%;padding:4px;font-size:10px" onclick="window._ui.net.equipSkin('${bType}','${sk.id}')">Equip (50💎)</button>`}</div>`).join('');
  }

  async openClan() {
    const modal = document.getElementById('clanModal'); const content = document.getElementById('clanContent'); modal.style.display = 'flex';
    const clans = await this.net.get('/api/clan/list');
    content.innerHTML = `
      <div class="row" style="margin-bottom:12px"><input id="c_name" placeholder="Clan Name" style="flex:1"/><input id="c_tag" placeholder="Tag" style="width:80px"/><button id="createClanBtn" class="primary">Create</button></div>
      <div id="clanList">${clans.map(c => `<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #333"><span>[${c.tag}] ${c.name} (${c.members})</span><button onclick="window._ui.joinClan(${c.id})">Join</button></div>`).join('')}</div>
    `;
    document.getElementById('createClanBtn').onclick = () => this.net.post('/api/clan/create', { name: document.getElementById('c_name').value, tag: document.getElementById('c_tag').value }).then(() => this.toast('Clan created!'));
  }
  joinClan(id) { this.net.post('/api/clan/join', { clanId: id }).then(() => { this.toast('Joined clan!'); document.getElementById('clanModal').style.display = 'none'; }); }

  populateBuildMenu() {
    document.getElementById('buildMenu').innerHTML = (BUILDING_TABS[this.activeTab] || []).map(b => `<button class="build-btn" onclick="window._ui.emit('placing', '${b.type}')"><span>${b.icon}</span><small>${b.name}</small><em>₱/⚡</em></button>`).join('');
  }
  populateTroopMenu() {
    const tm = document.getElementById('troopMenu'); tm.innerHTML = TROOPS_UI.map(t => `<button class="train-btn" onclick="window._ui.emit('train', '${t.type}')"><span>${t.icon}</span><small>${t.name}</small><em>25E</em></button>`).join('');
  }

  showAuth() { document.getElementById('auth').style.display = 'flex'; }
  hideAuth() { document.getElementById('auth').style.display = 'none'; }
  showGame() { this.hideAuth(); document.getElementById('hud').style.display = 'block'; this.populateBuildMenu(); this.populateTroopMenu(); }

  async tryAuth(mode) {
    const u = document.getElementById('u').value.trim(); const p = document.getElementById('p').value; const err = document.getElementById('authErr'); err.textContent = '';
    try { if (mode === 'login') await this.net.login(u, p); else await this.net.register(u, p); } catch (e) { err.textContent = e.message; }
  }

  refresh() {
    const s = this.s.player; if (!s) return;
    document.getElementById('pera').textContent = Math.floor(s.pera); document.getElementById('energiya').textContent = Math.floor(s.energiya);
    document.getElementById('kristal').textContent = s.kristal; document.getElementById('galing').textContent = s.galing; document.getElementById('xp').textContent = s.xp;
    if (this.s.selected) { const fresh = s.buildings.find(b => b.id === this.s.selected.id); this.showSelected(fresh); }
    this.tickTimers();
  }

  showSelected(b) {
    const panel = document.getElementById('selPanel'); if (!b) { panel.style.display = 'none'; return; } panel.style.display = 'block';
    const cfg = this.s.player.config.BUILDINGS[b.type]; const maxLvl = this.s.player.config.MAX_LEVEL;
    let actionBtnHtml = ''; let canUpgrade = false;
    if (b.level < maxLvl) {
      if (b.upgrade_ready_at > 0) actionBtnHtml = `<button disabled>Upgrading... ${Math.max(0, Math.ceil((b.upgrade_ready_at - Date.now()) / 1000))}s</button>`;
      else {
        const mult = Math.pow(1.6, b.level); const cPera = Math.floor((cfg.basePera||0) * mult); const cEn = Math.floor((cfg.baseEnergiya||0) * mult);
        let costStr = []; if (cPera > 0) costStr.push(`${cPera}₱`); if (cEn > 0) costStr.push(`${cEn}E`);
        actionBtnHtml = `<button class="primary" id="btnUpgrade">Upgrade (${costStr.join(' ')})</button>`; canUpgrade = true;
      }
    } else actionBtnHtml = `<button disabled>MAX LEVEL</button>`;
    panel.innerHTML = `<b>${cfg.name}</b><div class="stats">Level ${b.level} / ${maxLvl}</div>${actionBtnHtml}<button id="closeSel">×</button>`;
    document.getElementById('closeSel').onclick = () => { this.s.selected = null; panel.style.display = 'none'; };
    if (canUpgrade) document.getElementById('btnUpgrade').onclick = () => this.emit('upgrade', b.id);
  }

  tickTimers() {
    const s = this.s.player; if (!s) return;
    const q = document.getElementById('queue'); const now = Date.now();
    q.innerHTML = s.queue.map(t => `<div class="q-item">${t.type} <em>${Math.max(0, Math.ceil((t.ready_at - now) / 1000))}s</em></div>`).join('');
  }
  addChat(user, msg) { const log = document.getElementById('chatLog'); const line = document.createElement('div'); line.innerHTML = `<b>${user}:</b> ${msg}`; log.appendChild(line); log.scrollTop = log.scrollHeight; }
  showAnnouncement(msg) { const b = document.getElementById('announceBanner'); b.textContent = `📢 ${msg}`; b.classList.add('show'); clearTimeout(this._announceT); this._announceT = setTimeout(() => b.classList.remove('show'), 6000); }
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('show'), 2500); }

  async openRaid() {
    const modal = document.getElementById('raidModal'); const content = document.getElementById('raidContent'); modal.style.display = 'flex'; content.innerHTML = '<p>Scouting...</p>';
    try {
      const { target, procedural } = await this.net.findRaid();
      this.s.raidTarget = target;
      content.innerHTML = `<p>Target: <b>${target.username}</b></p><div id="deployList"></div><div class="row"><button id="doAttack" class="primary">LABAN!</button><button id="cancelRaid">Cancel</button></div>`;
      const list = document.getElementById('deployList'); const deploy = {};
      for (const t of this.s.player.troops) {
        if (t.count <= 0) continue;
        const row = document.createElement('div'); row.className = 'deploy-row';
        row.innerHTML = `<span>${t.type}</span> <input type="number" min="0" max="${t.count}" value="0" /> / ${t.count}`;
        row.querySelector('input').oninput = (e) => { deploy[t.type] = parseInt(e.target.value) || 0; };
        list.appendChild(row);
      }
      document.getElementById('doAttack').onclick = () => { modal.style.display = 'none'; window._startBattle(target, deploy, false); };
      document.getElementById('cancelRaid').onclick = () => { this.s.raidTarget = null; modal.style.display = 'none'; };
    } catch (e) { content.innerHTML = `<p class="err">${e.message}</p>`; }
  }

  async openCampaign() {
    const modal = document.getElementById('raidModal'); const content = document.getElementById('raidContent'); modal.style.display = 'flex'; content.innerHTML = '<p>Loading Campaign...</p>';
    try {
      const { target } = await this.net.get('/api/campaign/find');
      content.innerHTML = `<p>Mission: <b>${target.username}</b></p><div id="deployList"></div><div class="row"><button id="doAttack" class="primary">LABAN!</button><button id="cancelRaid">Cancel</button></div>`;
      const list = document.getElementById('deployList'); const deploy = {};
      for (const t of this.s.player.troops) {
        if (t.count <= 0) continue;
        const row = document.createElement('div'); row.className = 'deploy-row';
        row.innerHTML = `<span>${t.type}</span> <input type="number" min="0" max="${t.count}" value="0" /> / ${t.count}`;
        row.querySelector('input').oninput = (e) => { deploy[t.type] = parseInt(e.target.value) || 0; };
        list.appendChild(row);
      }
      document.getElementById('doAttack').onclick = () => { modal.style.display = 'none'; window._startBattle(target, deploy, true); };
      document.getElementById('cancelRaid').onclick = () => { modal.style.display = 'none'; };
    } catch (e) { content.innerHTML = `<p class="err">${e.message}</p>`; }
  }
}