import * as THREE from 'three';

export class Input3D {
  constructor(canvas, state, scene) {
    this.canvas = canvas; this.state = state; this.scene = scene;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.downPos = null; this.placing = false;
    this.bind();
  }
  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => { this.downPos = { x: e.clientX, y: e.clientY, t: Date.now() }; if (this.placing) this.scene.controls.enabled = false; });
    c.addEventListener('pointermove', e => { if (!this.placing) return; const { gx, gy } = this.getGridPos(e.clientX, e.clientY); if (gx !== null) this.scene.updateGhost(this.state.placing, gx, gy); });
    c.addEventListener('pointerup', e => {
      this.scene.controls.enabled = true; if (!this.downPos) return;
      const dist = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
      const time = Date.now() - this.downPos.t;
      if (dist < 8 && time < 300) this.handleTap(e.clientX, e.clientY);
      this.downPos = null;
    });
  }
  getGridPos(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((sx - rect.left) / rect.width) * 2 - 1; this.pointer.y = -((sy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);
    const hits = this.raycaster.intersectObject(this.scene.ground);
    if (hits.length > 0) { const p = hits[0].point; return { gx: Math.floor(p.x) + 16, gy: Math.floor(p.z) + 16 }; }
    return { gx: null, gy: null };
  }
  handleTap(sx, sy) {
    if (this.scene.inCombat) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((sx - rect.left) / rect.width) * 2 - 1; this.pointer.y = -((sy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.scene.camera);

    if (this.placing) { const { gx, gy } = this.getGridPos(sx, sy); if (gx !== null) this.onPlace?.(gx, gy); return; }

    const meshes = Array.from(this.scene.buildingMeshes.values());
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      let obj = hits[0].object; while (obj.parent && !obj.userData.building) obj = obj.parent;
      if (obj.userData.building) { this.state.selected = obj.userData.building; this.onSelect?.(obj.userData.building); return; }
    }
    this.state.selected = null; this.onSelect?.(null);
  }
  enablePlacing() { this.placing = true; }
  disablePlacing() { this.placing = false; this.scene.updateGhost(null); }
}