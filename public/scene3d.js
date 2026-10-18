import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene3D {
  constructor(canvas, state) {
    this.canvas = canvas; this.state = state;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 90);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(25, 30, 25);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI / 2.1;

    const amb = new THREE.AmbientLight(0xffffff, 0.5); this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffe0a0, 1.5);
    dir.position.set(20, 40, 20); dir.castShadow = true;
    dir.shadow.mapSize.width = 2048; dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.left = -25; dir.shadow.camera.right = 25; dir.shadow.camera.top = 25; dir.shadow.camera.bottom = -25;
    this.scene.add(dir);

    // Water
    const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x2266aa, transparent: true, opacity: 0.8, roughness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1; this.scene.add(water);

    // Ground
    this.ground = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 34), new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 }));
    this.ground.position.y = -0.5; this.ground.receiveShadow = true; this.scene.add(this.ground);

    // Trees
    const treeGeo = new THREE.ConeGeometry(1, 3, 6); const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d });
    this.trees = new THREE.InstancedMesh(treeGeo, treeMat, 60); const dummy = new THREE.Object3D();
    for (let i = 0; i < 60; i++) {
      let x, z; do { x = (Math.random() - 0.5) * 30; z = (Math.random() - 0.5) * 30; } while (Math.abs(x) < 10 && Math.abs(z) < 10);
      dummy.position.set(x, 1.5, z); dummy.scale.setScalar(0.8 + Math.random()*0.5); dummy.updateMatrix(); this.trees.setMatrixAt(i, dummy.matrix);
    }
    this.trees.castShadow = true; this.scene.add(this.trees);

    this.buildingMeshes = new Map(); this.ghost = null;
    this.combatTroops = []; this.inCombat = false;
  }

  resize() { const w = window.innerWidth, h = window.innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  render() {
    this.controls.update();
    if (this.inCombat) this.updateCombat();
    this.renderer.render(this.scene, this.camera);
  }

  syncBuildings(buildings) {
    for (const [id, mesh] of this.buildingMeshes.entries()) if (!buildings.find(b => b.id === id)) { this.scene.remove(mesh); this.buildingMeshes.delete(id); }
    for (const b of buildings) {
      if (this.buildingMeshes.has(b.id)) {
        const mesh = this.buildingMeshes.get(b.id); mesh.userData.building = b; mesh.scale.y = 1 + (b.level - 1) * 0.1;
      } else {
        const mesh = this.createBuildingMesh(b); this.scene.add(mesh); this.buildingMeshes.set(b.id, mesh);
      }
    }
  }

  createBuildingMesh(b) {
    const cfg = this.state.player?.config?.BUILDINGS?.[b.type] || { size: 1 }; const size = cfg.size;
    const group = new THREE.Group(); group.userData.building = b;
    
    let baseCol = 0x8a6a3a, roofCol = 0xb8451f;
    if (b.type === 'barangay_hall') { baseCol = 0xd4752c; roofCol = 0xffd966; }
    if (b.type === 'kalamansi_farm') { baseCol = 0x4a7a3a; roofCol = 0x8ac96a; }

    const base = new THREE.Mesh(new THREE.BoxGeometry(size, 0.4, size), new THREE.MeshStandardMaterial({ color: 0x5a4a2a }));
    base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true; group.add(base);

    const walls = new THREE.Mesh(new THREE.BoxGeometry(size * 0.85, 1.8, size * 0.85), new THREE.MeshStandardMaterial({ color: baseCol }));
    walls.position.y = 1.3; walls.castShadow = true; walls.receiveShadow = true; group.add(walls);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.75, 1.8, 4), new THREE.MeshStandardMaterial({ color: roofCol }));
    roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);

    group.position.set(b.x + size/2 - 16, 0, b.y + size/2 - 16);
    return group;
  }

  updateGhost(type, gx, gy) {
    if (this.ghost) this.scene.remove(this.ghost);
    if (!type) { this.ghost = null; return; }
    const cfg = this.state.player?.config?.BUILDINGS?.[type] || { size: 1 };
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(cfg.size, 0.5, cfg.size), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }));
    this.ghost.position.set(gx + cfg.size/2 - 16, 0.25, gy + cfg.size/2 - 16); this.scene.add(this.ghost);
  }

  // --- COMBAT SIMULATION ---
  startBattle(target, troops, onComplete) {
    this.inCombat = true; this.onCombatEnd = onComplete;
    this.combatTroops = [];
    // Clear base, show target
    for (const m of this.buildingMeshes.values()) this.scene.remove(m);
    this.buildingMeshes.clear();
    for (const b of target.buildings) {
      const mesh = this.createBuildingMesh(b); this.scene.add(mesh); this.buildingMeshes.set(b.id, mesh);
    }

    // Spawn troops
    let spawnIdx = 0;
    for (const [t, count] of Object.entries(troops)) {
      for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: t === 'higante' ? 0xff0000 : 0x00ff00 });
        const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
        mesh.position.set(-14 + Math.random()*3, 0.5, -14 + Math.random()*3);
        this.scene.add(mesh);
        
        // Find nearest building target
        const targetB = target.buildings[Math.floor(Math.random()*target.buildings.length)];
        this.combatTroops.push({ mesh, targetB, speed: 0.1 + Math.random()*0.05, hp: 10 });
      }
    }
  }

  updateCombat() {
    let allDead = true;
    for (const t of this.combatTroops) {
      if (t.hp <= 0) { t.mesh.visible = false; continue; }
      allDead = false;
      const bCfg = this.state.player.config.BUILDINGS[t.targetB.type] || { size: 1 };
      const tx = t.targetB.x + bCfg.size/2 - 16; const tz = t.targetB.y + bCfg.size/2 - 16;
      
      const dx = tx - t.mesh.position.x; const dz = tz - t.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        t.mesh.position.x += (dx / dist) * t.speed; t.mesh.position.z += (dz / dist) * t.speed;
        t.mesh.rotation.y = Math.atan2(dx, dz);
      } else {
        t.hp -= 1; // attack building, building loses hp, etc
      }
    }
    if (allDead) { this.inCombat = false; this.onCombatEnd?.(); }
  }

  resetToBase(buildings) {
    for (const m of this.buildingMeshes.values()) this.scene.remove(m);
    for (const m of this.combatTroops) this.scene.remove(m.mesh);
    this.buildingMeshes.clear(); this.combatTroops = []; this.inCombat = false;
    this.syncBuildings(buildings);
  }
}