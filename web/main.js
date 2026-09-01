// 3D neon client for Untitled Music Game.
//
// Talks to the same server that serves this file:
//   GET  /state           -> current game state
//   POST /move  {direction:'left'|'right'}
//   POST /reset
//
// All meshes come from the hand-editable OBJ files in /assets/models.
// Materials (the neon glow) are assigned here so the bloom pass has
// something to work with; the .mtl files carry equivalent colours for
// Blender.

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GRID = 5;
const HALF = (GRID - 1) / 2; // grid index -> world coord: (i - HALF)
const BOTTOM_Z = GRID - 1 - HALF; // player row in world space
const TICK_MS = 1000; // server ticks once per second

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, 9, 20);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6.4, 7.4);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.32, // strength
  0.5, // radius
  0.22, // threshold
);
const BLOOM_BASE = bloom.strength;
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- lights

scene.add(new THREE.AmbientLight(0x2a3550, 0.9));

const key = new THREE.DirectionalLight(0xbcd4ff, 0.7);
key.position.set(4, 9, 6);
scene.add(key);

const cyanLight = new THREE.PointLight(0x2ee6ff, 26, 22);
cyanLight.position.set(-3, 3, -4);
scene.add(cyanLight);

const magentaLight = new THREE.PointLight(0xff3ea5, 20, 22);
magentaLight.position.set(3, 2.5, 5);
scene.add(magentaLight);

// ---------------------------------------------------------------- floor

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x070910, roughness: 0.9, metalness: 0.1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.13;
scene.add(floor);

// ---------------------------------------------------------------- materials

const mat = {
  tile: new THREE.MeshStandardMaterial({
    color: 0x14203a,
    emissive: 0x0a2e3a,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.35,
  }),
  tileActive: new THREE.MeshStandardMaterial({
    color: 0x1c2f4e,
    emissive: 0x115566,
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0.35,
  }),
  player: new THREE.MeshStandardMaterial({
    color: 0x3a1226,
    emissive: 0xff2e88,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0.45,
  }),
  playerHit: new THREE.MeshStandardMaterial({
    color: 0x4a1414,
    emissive: 0xff3826,
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0.45,
  }),
  note: new THREE.MeshStandardMaterial({
    color: 0x0e3438,
    emissive: 0x1ad0e0,
    emissiveIntensity: 1.0,
    roughness: 0.3,
    metalness: 0.55,
  }),
  pip: new THREE.MeshStandardMaterial({
    color: 0x123a24,
    emissive: 0x2bff7a,
    emissiveIntensity: 1.0,
    roughness: 0.35,
    metalness: 0.4,
  }),
  pipEmpty: new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.7,
    metalness: 0.2,
  }),
  frame: new THREE.MeshStandardMaterial({
    color: 0x241442,
    emissive: 0x7a2eff,
    emissiveIntensity: 0.75,
    roughness: 0.35,
    metalness: 0.55,
  }),
};

// ---------------------------------------------------------------- asset load

const loader = new OBJLoader();

function loadModel(name) {
  return loader.loadAsync(`/assets/models/${name}.obj`).then((group) => {
    // Collapse the loaded Group to a single reusable prototype.
    group.traverse((child) => {
      if (child.isMesh) child.geometry.computeVertexNormals();
    });
    return group;
  });
}

function applyMaterial(object, material) {
  object.traverse((child) => {
    if (child.isMesh) child.material = material;
  });
  return object;
}

const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const damage = document.getElementById('damage');

Promise.all([
  loadModel('tile'),
  loadModel('player'),
  loadModel('note'),
  loadModel('pip'),
  loadModel('frame'),
])
  .then(([tileProto, playerProto, noteProto, pipProto, frameProto]) => {
    start({ tileProto, playerProto, noteProto, pipProto, frameProto });
  })
  .catch((err) => {
    hud.textContent = 'failed to load models';
    console.error(err);
  });

// ---------------------------------------------------------------- game view

function start({ tileProto, playerProto, noteProto, pipProto, frameProto }) {
  const board = new THREE.Group();
  scene.add(board);

  // frame
  const frame = applyMaterial(frameProto.clone(), mat.frame);
  board.add(frame);

  // tiles
  const tiles = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const isBottom = row === GRID - 1;
      const tile = applyMaterial(tileProto.clone(), isBottom ? mat.tileActive : mat.tile);
      tile.scale.set(0.9, 1, 0.9);
      tile.position.set(col - HALF, 0, row - HALF);
      board.add(tile);
      tiles.push(tile);
    }
  }

  // player
  const player = applyMaterial(playerProto.clone(), mat.player);
  player.position.set(0, 0, BOTTOM_Z);
  board.add(player);
  let playerTargetX = 0;
  let playerHitUntil = 0;

  // health pips
  const pips = [];
  for (let i = 0; i < 3; i++) {
    const pip = applyMaterial(pipProto.clone(), mat.pip);
    pip.position.set((i - 1) * 0.55, 0.35, -HALF - 1.15);
    board.add(pip);
    pips.push(pip);
  }

  // falling notes
  const notesGroup = new THREE.Group();
  board.add(notesGroup);
  let live = []; // { col, row, mesh, fromZ, toZ, t0 }
  let dying = []; // { mesh, t0, hit }

  let lastHealth = null;
  let pulseUntil = 0;

  function makeNote() {
    const m = applyMaterial(noteProto.clone(), mat.note.clone());
    m.scale.setScalar(0.01);
    notesGroup.add(m);
    return m;
  }

  function retire(mesh, hit) {
    dying.push({ mesh, t0: performance.now(), hit });
  }

  function onState(s) {
    const now = performance.now();

    playerTargetX = s.square - HALF;

    // health
    if (lastHealth !== null && s.health < lastHealth) {
      damage.style.opacity = '1';
      setTimeout(() => (damage.style.opacity = '0'), 60);
      playerHitUntil = now + 260;
      shakeUntil = now + 320;
    }
    lastHealth = s.health;
    pips.forEach((pip, i) => {
      const alive = i < s.health;
      applyMaterial(pip, alive ? mat.pip : mat.pipEmpty);
      pip.visible = s.gameState !== 'over';
    });

    // hud + overlay
    const playing = s.gameState === 'playing';
    hud.textContent = playing ? `score ${'◆'.repeat(s.health)}` : '';
    overlay.hidden = s.gameState !== 'over';

    if (playing) pulseUntil = now + 180;

    // reconcile falling notes: each survivor dropped exactly one row
    const prev = live;
    const unused = prev.slice();
    live = [];

    for (const f of s.fallingLetters) {
      let mesh;
      let fromZ;
      const i = unused.findIndex((p) => p.col === f.column && p.row + 1 === f.row);
      if (i >= 0) {
        mesh = unused[i].mesh;
        fromZ = mesh.position.z;
        unused.splice(i, 1);
      } else {
        mesh = makeNote();
        fromZ = f.row - 1 - HALF;
      }
      live.push({ col: f.column, row: f.row, mesh, fromZ, toZ: f.row - HALF, t0: now });
    }

    // whatever is left fell off the bottom this tick
    for (const p of unused) retire(p.mesh, p.col === s.square);
  }

  // ------------------------------------------------------------ input

  function send(path, body) {
    fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') send('/move', { direction: 'left' });
    else if (e.key === 'ArrowRight') send('/move', { direction: 'right' });
    else if (e.key === 'r' || e.key === 'R') send('/reset');
  });

  // ------------------------------------------------------------ polling

  async function poll() {
    try {
      const res = await fetch('/state');
      onState(await res.json());
    } catch {
      /* server not ready yet */
    }
  }
  poll();
  setInterval(poll, TICK_MS);

  // ------------------------------------------------------------ render loop

  let shakeUntil = 0;

  function frameTick() {
    requestAnimationFrame(frameTick);
    const now = performance.now();

    // player glide + hit flash
    player.position.x += (playerTargetX - player.position.x) * 0.22;
    applyMaterial(player, now < playerHitUntil ? mat.playerHit : mat.player);
    player.rotation.y = Math.sin(now * 0.0012) * 0.12;

    // notes
    for (const p of live) {
      const k = Math.min(1, (now - p.t0) / TICK_MS);
      p.mesh.position.x = p.col - HALF;
      p.mesh.position.z = p.fromZ + (p.toZ - p.fromZ) * k;
      p.mesh.position.y = 0.5 + Math.sin(now * 0.004 + p.col * 1.7) * 0.06;
      p.mesh.rotation.y = now * 0.0022 + p.col;
      p.mesh.rotation.x = now * 0.0013;
      const sc = Math.min(1, p.mesh.scale.x + 0.09);
      p.mesh.scale.setScalar(sc);
    }

    // dying notes
    dying = dying.filter((d) => {
      const k = (now - d.t0) / 320;
      if (k >= 1) {
        d.mesh.parent.remove(d.mesh);
        return false;
      }
      d.mesh.scale.setScalar(Math.max(0.001, 1 - k) * (d.hit ? 1.6 : 1));
      d.mesh.position.y = 0.5 - k * 0.6;
      d.mesh.material.emissiveIntensity = (d.hit ? 3.2 : 1.6) * (1 - k);
      return true;
    });

    // pips shimmer
    pips.forEach((pip, i) => {
      pip.rotation.y = now * 0.0015 + i;
      pip.position.y = 0.35 + Math.sin(now * 0.003 + i) * 0.04;
    });

    // beat pulse
    const pulse = now < pulseUntil ? (pulseUntil - now) / 180 : 0;
    bloom.strength = BLOOM_BASE + pulse * 0.18;
    cyanLight.intensity = 26 + pulse * 12;

    // camera idle + shake
    const shake = now < shakeUntil ? (shakeUntil - now) / 320 : 0;
    camera.position.x = Math.sin(now * 0.00022) * 0.5 + (Math.random() - 0.5) * shake * 0.5;
    camera.position.y = 6.4 + (Math.random() - 0.5) * shake * 0.4;
    camera.lookAt(0, 0.3, 0.4);

    composer.render();
  }
  frameTick();
}

// ---------------------------------------------------------------- resize

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
