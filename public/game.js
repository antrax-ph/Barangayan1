import { Net } from './net.js';
import { Scene3D } from './scene3d.js';
import { Input3D } from './input3d.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const net = new Net();
const state = { player: null, selected: null, placing: null, raidTarget: null };

const scene = new Scene3D(canvas, state);
const input = new Input3D(canvas, state, scene);
const ui = new UI(state, net, scene);
window._ui = ui; // Global for buttons

net.on('state', (s) => { state.player = s; ui.refresh(); scene.syncBuildings(s.buildings); });
net.on('auth', (s) => { state.player = s; ui.showGame(); ui.refresh(); scene.syncBuildings(s.buildings); });
net.on('announce', (m) => ui.showAnnouncement(m.message));
net.on('chat', (m) => ui.addChat(m.user, m.message));

ui.on('placing', (type) => { state.placing = type; input.enablePlacing(); });
ui.on('train', (t) => net.train(t));
ui.on('upgrade', (id) => net.upgrade(id));
ui.on('raid', () => ui.openRaid());
ui.on('campaign', () => ui.openCampaign());

input.onPlace = (x, y) => {
  if (!state.placing) return;
  net.build(state.placing, x, y).then(() => {
    state.placing = null; input.disablePlacing(); ui.toast("Naitayo!");
  }).catch(e => ui.toast(e.message));
};
input.onSelect = (b) => ui.showSelected(b);

// 3D Combat Simulation Trigger
window._startBattle = (target, troops, isCampaign) => {
  ui.toast("Laban na!");
  scene.startBattle(target, troops, () => {
    net.attack(target.id, troops, isCampaign).then(r => {
      ui.toast(r.win ? `Victory! +${r.lootPera}₱` : `Defeat. +${r.lootPera}₱`);
      ui.refresh();
      scene.resetToBase(state.player.buildings);
    }).catch(e => { ui.toast(e.message); scene.resetToBase(state.player.buildings); });
  });
};

function loop() { scene.render(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.addEventListener('resize', () => scene.resize());
scene.resize();