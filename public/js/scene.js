// Mundo 3D: ilha flutuante, plataformas de resposta, avatares, emotes, pódio e confete.
import * as THREE from 'three';

export const BODY_COLORS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#3bd16f', '#2ec4b6', '#3a86ff', '#7b5cff', '#c77dff', '#ff70a6', '#f1f1f1', '#3d3d4e', '#8d5a3b'];
export const SKIN_COLORS = ['#ffe0c7', '#f7c59f', '#e0a273', '#c68642', '#8d5524', '#5c3a1e'];
export const HATS = ['Nenhum', 'Boné', 'Coroa', 'Mago', 'Cartola', 'Gatinho', 'Chifres', 'Hélice', 'Fones'];
export const EYES = ['Normal', 'Brilhantes', 'Óculos', 'Sonolento'];
export const ACCS = ['Nenhum', 'Capa', 'Mochila', 'Cachecol', 'Asas'];
export const EMOTES = [['👋', 'Oi!'], ['💃', 'Dança'], ['😂', 'Haha'], ['🔥', 'Fogo'], ['😍', 'Amei'], ['🤯', 'Uau'], ['😎', 'Estilo'], ['😭', 'Buá']];
export const PAD_COLORS = ['#ff4d6d', '#3a86ff', '#ffbe0b', '#2ec27e'];
export const PAD_SHAPES = ['▲', '◆', '●', '■'];
const PAD_POS = [[-5, -5], [5, -5], [-5, 5], [5, 5]];

let renderer, scene, camera, clock, grad;
const camPos = new THREE.Vector3(0, 12, 26), camLook = new THREE.Vector3(), camLookT = new THREE.Vector3();
let camMode = 'orbit';
const avatars = new Map(); // id -> avatar group
const pads = [], floaters = [], clouds = [], bubbles = [];
let podium, confetti, confettiT = 0, marker, onGround = null, beam;

const toon = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...extra });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

export function textSprite(text, { size = 64, color = '#fff', stroke = '#24124f', scale = 0.6, font = '"Lilita One", sans-serif' } = {}) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = `${size}px ${font}`;
  c.width = Math.ceil(ctx.measureText(text).width + size * 0.7); c.height = Math.ceil(size * 1.45);
  ctx.font = `${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.18; ctx.strokeStyle = stroke;
  if (stroke) ctx.strokeText(text, c.width / 2, c.height / 2);
  ctx.fillStyle = color; ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set((c.width / c.height) * scale, scale, 1);
  return s;
}

// ---------- símbolos matemáticos 3D feitos de blocos ----------
function opSymbol(type, color) {
  const g = new THREE.Group(), m = toon(color), bar = () => new THREE.BoxGeometry(1.6, 0.42, 0.42);
  if (type === 0 || type === 2) { g.add(mesh(bar(), m)); const v = mesh(bar(), m); v.rotation.z = Math.PI / 2; g.add(v); if (type === 2) g.rotation.z = Math.PI / 4; }
  if (type === 1) g.add(mesh(bar(), m));
  if (type === 3) { g.add(mesh(bar(), m)); g.add(mesh(new THREE.SphereGeometry(0.27, 12, 10), m, 0, 0.62, 0)); g.add(mesh(new THREE.SphereGeometry(0.27, 12, 10), m, 0, -0.62, 0)); }
  if (type === 4) { const b = mesh(bar(), m, 0, 0.3, 0), b2 = mesh(bar(), m, 0, -0.3, 0); g.add(b, b2); } // =
  return g;
}

// ---------- avatar ----------
export function buildAvatar(cfg = {}, name = '') {
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const bc = BODY_COLORS[cfg.body | 0] || BODY_COLORS[0], sc = SKIN_COLORS[cfg.skin | 0] || SKIN_COLORS[0];
  const bm = toon(bc), sm = toon(sc), dark = toon('#1d1433'), white = toon('#ffffff');
  rig.add(mesh(new THREE.CapsuleGeometry(0.45, 0.45, 6, 16), bm, 0, 0.78, 0));
  const belly = mesh(new THREE.SphereGeometry(0.2, 12, 10), toon(new THREE.Color(bc).offsetHSL(0, 0, 0.12)), 0, 0.72, 0.33); belly.scale.set(1.3, 1.2, 0.5); rig.add(belly);
  const head = new THREE.Group(); head.position.y = 1.58; rig.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.44, 24, 18), sm));
  // olhos
  const e = cfg.eyes | 0;
  if (e === 2) {
    head.add(mesh(new THREE.BoxGeometry(0.62, 0.15, 0.06), dark, 0, 0.06, 0.42));
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), toon('#7fdbff'), -0.2, 0.09, 0.455));
  } else for (const sx of [-0.16, 0.16]) {
    if (e === 3) { const l = mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, sx, 0.06, 0.4); l.scale.set(1.2, 0.3, 0.5); head.add(l); continue; }
    const s = e === 1 ? 1.35 : 1;
    head.add(mesh(new THREE.SphereGeometry(0.1 * s, 12, 10), white, sx, 0.07, 0.36));
    head.add(mesh(new THREE.SphereGeometry(0.06 * s, 10, 8), dark, sx, 0.07, 0.43 + 0.02 * s));
    head.add(mesh(new THREE.SphereGeometry(0.02 * s, 6, 6), white, sx + 0.025, 0.1, 0.48 + 0.03 * s));
  }
  const mouth = mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14, Math.PI), dark, 0, -0.12, 0.4); mouth.rotation.z = Math.PI; head.add(mouth);
  for (const sx of [-0.27, 0.27]) { const ch = mesh(new THREE.SphereGeometry(0.07, 8, 6), toon('#ff8fab'), sx, -0.06, 0.33); ch.scale.z = 0.4; head.add(ch); }
  // chapéus
  const h = cfg.hat | 0, gold = toon('#ffd23f');
  if (h === 1) { const cap = mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ff4d6d'), 0, 0.08, 0); head.add(cap); const br = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), toon('#ff4d6d'), 0, 0.1, 0.38); br.scale.z = 0.8; head.add(br); }
  if (h === 2) { head.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20, 1, true), gold, 0, 0.45, 0)); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; head.add(mesh(new THREE.ConeGeometry(0.07, 0.18, 6), gold, Math.sin(a) * 0.3, 0.63, Math.cos(a) * 0.3)); } head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#ff4d6d'), 0, 0.45, 0.31)); }
  if (h === 3) { head.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 24), toon('#5b2bd9'), 0, 0.32, 0)); const c = mesh(new THREE.ConeGeometry(0.4, 0.95, 20), toon('#5b2bd9'), 0, 0.8, 0); c.rotation.z = 0.15; head.add(c); head.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), gold, -0.13, 1.26, 0)); }
  if (h === 4) { head.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24), dark, 0, 0.34, 0)); head.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.55, 20), dark, 0, 0.62, 0)); head.add(mesh(new THREE.CylinderGeometry(0.325, 0.325, 0.1, 20), toon('#ff4d6d'), 0, 0.42, 0)); }
  if (h === 5) for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.14, 0.3, 4), bm, sx * 0.26, 0.4, 0); ear.rotation.z = -sx * 0.4; head.add(ear); }
  if (h === 6) for (const sx of [-1, 1]) { const hn = mesh(new THREE.ConeGeometry(0.08, 0.35, 10), white, sx * 0.25, 0.42, 0.05); hn.rotation.z = -sx * 0.5; head.add(hn); }
  if (h === 7) { head.add(mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#3a86ff'), 0, 0.08, 0)); head.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), dark, 0, 0.6, 0)); const p = new THREE.Group(); p.position.y = 0.7; p.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.12), toon('#ffd23f'))); p.add(mesh(new THREE.BoxGeometry(0.12, 0.03, 0.9), toon('#ff4d6d'))); head.add(p); root.userData.prop = p; }
  if (h === 8) { const band = mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 24, Math.PI), dark, 0, 0.05, 0); head.add(band); for (const sx of [-0.45, 0.45]) { const cup = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16), toon('#ff70a6'), sx, 0.02, 0); cup.rotation.z = Math.PI / 2; head.add(cup); } }
  // braços e pés
  const arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.46, 1.0, 0); rig.add(piv);
    const arm = mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), bm, 0, -0.22, 0); piv.add(arm);
    piv.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), sm, 0, -0.45, 0));
    piv.rotation.z = sx * 0.25; arms.push(piv);
    const foot = mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(new THREE.Color(bc).offsetHSL(0, 0, -0.18)), sx * 0.2, 0.12, 0.06); foot.scale.set(1, 0.7, 1.3); rig.add(foot);
  }
  // acessórios
  const a = cfg.acc | 0;
  if (a === 1) { const cape = mesh(new THREE.BoxGeometry(0.8, 0.95, 0.04), toon('#e63946'), 0, 0.75, -0.42); cape.rotation.x = 0.15; rig.add(cape); root.userData.cape = cape; }
  if (a === 2) { rig.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.28), toon('#ffbe0b'), 0, 0.85, -0.5)); rig.add(mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), toon('#ff8c42'), 0, 0.7, -0.67)); }
  if (a === 3) { const sc2 = mesh(new THREE.TorusGeometry(0.33, 0.1, 8, 20), toon('#2ec4b6'), 0, 1.2, 0); sc2.rotation.x = Math.PI / 2; rig.add(sc2); rig.add(mesh(new THREE.BoxGeometry(0.16, 0.4, 0.08), toon('#2ec4b6'), 0.18, 0.98, 0.33)); }
  if (a === 4) { const wings = []; for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.15, 1.0, -0.4); const w = mesh(new THREE.SphereGeometry(0.4, 12, 10), toon('#ffffff'), sx * 0.35, 0.1, 0); w.scale.set(1, 0.6, 0.12); piv.add(w); rig.add(piv); wings.push(piv); } root.userData.wings = wings; }
  if (name) { const tag = textSprite(name, { size: 56, scale: 0.5 }); tag.position.y = 2.55 + (h === 3 ? 0.4 : 0); root.add(tag); root.userData.tag = tag; }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  root.scale.setScalar(1.25);
  Object.assign(root.userData, { rig, head, arms, target: new THREE.Vector3(), emote: null, mood: null, phase: Math.random() * 10, cfg });
  return root;
}

// ---------- inicialização ----------
export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog('#c9a7ff', 45, 110);
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300); camera.position.copy(camPos);
  clock = new THREE.Clock();
  grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

  // céu em degradê
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4b2bd9') }, mid: { value: new THREE.Color('#a78bfa') }, bot: { value: new THREE.Color('#ffb3d9') } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vp; void main(){ float h = vp.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.6, h)) : mix(mid, bot, smoothstep(0.0, -0.4, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);
  // estrelinhas
  const sg = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 400; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(150); if (v.y > 10) sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 0.7, fog: false, transparent: true, opacity: 0.8 })));

  scene.add(new THREE.HemisphereLight('#ffe9ff', '#5b3fa8', 1.4));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.2); sun.position.set(12, 24, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ilha
  const island = new THREE.Group(); scene.add(island);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.8, 48), toon('#7ee081')); top.position.y = -0.4; top.receiveShadow = true; island.add(top);
  const dirt = mesh(new THREE.CylinderGeometry(12.2, 11, 1.2, 48), toon('#b07a4f'), 0, -1.3, 0); island.add(dirt);
  const rock = mesh(new THREE.ConeGeometry(11, 9, 12), toon('#7a5aa6'), 0, -6.4, 0); rock.rotation.x = Math.PI; island.add(rock);
  for (let i = 0; i < 5; i++) { const r = mesh(new THREE.DodecahedronGeometry(R(0.6, 1.4)), toon('#8a6bc0'), R(-8, 8), -3 - R(0, 5), R(-8, 8)); island.add(r); }
  // círculo central e caminho
  const center = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 40), toon('#fff1a8')); center.position.y = 0.03; center.receiveShadow = true; island.add(center);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 8, 48), toon('#ffbe0b')); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; island.add(ring);
  // árvores e arbustos na borda
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, r = 10.6 + Math.random() * 0.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 6 && Math.abs(x) < 7) continue; // deixa a frente livre para a câmera
    if (i % 2) { const t = new THREE.Group(); t.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 8), toon('#8d5a3b'), 0, 0.6, 0)); t.add(mesh(new THREE.ConeGeometry(0.9, 1.6, 8), toon(['#2ec27e', '#3bd16f', '#ff70a6'][i % 3]), 0, 1.8, 0)); t.add(mesh(new THREE.ConeGeometry(0.7, 1.2, 8), toon(['#3bd16f', '#7ee081', '#ffb3d9'][i % 3]), 0, 2.5, 0)); t.position.set(x, 0, z); island.add(t); }
    else { const b = mesh(new THREE.SphereGeometry(0.7, 12, 10), toon('#4cc96b'), x, 0.35, z); b.scale.y = 0.7; island.add(b); }
  }
  // plataformas de resposta
  PAD_POS.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const base = mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.5, 6), toon(PAD_COLORS[i]), 0, 0.25, 0); base.receiveShadow = true; g.add(base);
    const rim = mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.08, 6), toon(new THREE.Color(PAD_COLORS[i]).offsetHSL(0, 0, 0.15)), 0, 0.52, 0); rim.receiveShadow = true; g.add(rim);
    const icon = textSprite(PAD_SHAPES[i], { size: 90, scale: 1.3, stroke: '#24124f', font: 'sans-serif' }); icon.position.y = 2.3; g.add(icon);
    const light = new THREE.PointLight(PAD_COLORS[i], 0, 8); light.position.y = 2; g.add(light);
    g.userData = { base, icon, light, y: 0 }; island.add(g); pads.push(g);
  });
  // feixe de luz da resposta certa
  beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.1, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff7a8', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 2.5; scene.add(beam);
  // símbolos flutuantes
  const fc = ['#ff4d6d', '#3a86ff', '#ffbe0b', '#2ec27e', '#ff70a6', '#ffffff', '#c77dff'];
  for (let i = 0; i < 22; i++) {
    const s = opSymbol(i % 5, fc[i % fc.length]); const a = Math.random() * Math.PI * 2, r = R(18, 38);
    s.position.set(Math.cos(a) * r, R(-6, 16), Math.sin(a) * r); s.scale.setScalar(R(0.7, 1.6));
    s.userData = { y: s.position.y, sp: R(0.3, 1), ph: Math.random() * 6 }; scene.add(s); floaters.push(s);
  }
  for (let i = 0; i < 9; i++) { const n = textSprite(String(i + 1), { size: 80, scale: R(2, 3.5), color: fc[i % fc.length], stroke: '#ffffff' }); const a = Math.random() * Math.PI * 2, r = R(22, 40); n.position.set(Math.cos(a) * r, R(0, 18), Math.sin(a) * r); n.userData = { y: n.position.y, sp: R(0.3, 0.8), ph: i }; scene.add(n); floaters.push(n); }
  // nuvens
  const cm = toon('#ffffff', { transparent: true, opacity: 0.95 });
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group(); for (let j = 0; j < 5; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(R(1.2, 2.4), 12, 10), cm); s.position.set(j * 1.6 - 3.2, Math.random(), Math.random()); c.add(s); }
    const a = Math.random() * Math.PI * 2, r = R(30, 70); c.position.set(Math.cos(a) * r, R(-14, 8), Math.sin(a) * r); c.userData.sp = R(0.5, 1.5); scene.add(c); clouds.push(c);
  }
  // pódio
  podium = new THREE.Group(); podium.visible = false; scene.add(podium);
  [[0, 2.2, '#ffd23f', '1'], [-2.3, 1.5, '#d9e2ec', '2'], [2.3, 1.0, '#e09f5a', '3']].forEach(([x, h, c, n]) => {
    const b = mesh(new THREE.BoxGeometry(2.1, h, 2.1), toon(c), x, h / 2, 0); b.receiveShadow = true; podium.add(b);
    const t = textSprite(n, { size: 90, scale: 1, color: '#fff' }); t.position.set(x, h / 2, 1.2); podium.add(t);
  });
  // marcador de clique
  marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0 })); marker.rotation.x = -Math.PI / 2; marker.position.y = 0.06; scene.add(marker);
  // confete
  const cg = new THREE.PlaneGeometry(0.18, 0.28);
  confetti = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 350);
  confetti.userData.p = [...Array(350)].map(() => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: R(2, 8) }));
  const col = new THREE.Color(); for (let i = 0; i < 350; i++) confetti.setColorAt(i, col.set(fc[i % fc.length]));
  confetti.visible = false; scene.add(confetti);

  // clique no chão para andar
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (ev) => {
    if (!onGround) return;
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit) || Math.hypot(hit.x, hit.z) > 10) return;
    marker.position.x = hit.x; marker.position.z = hit.z; marker.material.opacity = 1; marker.scale.setScalar(0.5);
    onGround(hit.x, hit.z);
  });

  addEventListener('resize', resize); resize();
  renderer.setAnimationLoop(tick);
}
const R = (a, b) => a + Math.random() * (b - a);

function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

// ---------- API ----------
export function setGroundHandler(fn) { onGround = fn; }
export function setCamera(mode) { camMode = mode; }

export function addAvatar(id, cfg, name, x = 0, z = 0) {
  removeAvatar(id);
  const a = buildAvatar(cfg, name); a.position.set(x, 0, z); a.userData.target.set(x, 0, z); a.rotation.y = Math.random() * 6;
  scene.add(a); avatars.set(id, a); poof(a.position); return a;
}
export function removeAvatar(id) { const a = avatars.get(id); if (a) { scene.remove(a); avatars.delete(id); } }
export function clearAvatars() { for (const id of [...avatars.keys()]) removeAvatar(id); }
export function hasAvatar(id) { return avatars.has(id); }
export function moveAvatar(id, x, z, instant) { const a = avatars.get(id); if (!a) return; a.userData.target.set(x, 0, z); if (instant) a.position.set(x, 0, z); }
export function setMood(id, mood) { const a = avatars.get(id); if (a) { a.userData.mood = mood; a.userData.moodT = 0; } }
export function spinAvatar(id, s) { const a = avatars.get(id); if (a) a.userData.spin = s; }
export function avatarIds() { return [...avatars.keys()]; }

export function emote(id, idx) {
  const a = avatars.get(id); if (!a) return;
  a.userData.emote = { i: idx, t: 0 };
  const s = textSprite(EMOTES[idx][0], { size: 100, scale: 1.1, stroke: null, font: 'sans-serif' });
  s.position.copy(a.position).y += 3.6; s.userData = { t: 0, x: a.position.x, z: a.position.z }; scene.add(s); bubbles.push(s);
}

function poof(pos) {
  for (let i = 0; i < 5; i++) { const s = textSprite('✦', { size: 60, scale: 0.4, color: '#fff', stroke: null, font: 'sans-serif' }); s.position.set(pos.x + R(-0.6, 0.6), R(0.5, 2), pos.z + R(-0.6, 0.6)); s.userData = { t: 0, x: s.position.x, z: s.position.z, fast: true }; scene.add(s); bubbles.push(s); }
}

// coloca avatares em círculo no centro
export function ringLayout(ids) {
  const n = ids.length;
  ids.forEach((id, i) => { const a = (i / Math.max(1, n)) * Math.PI * 2, r = n < 2 ? 0 : Math.min(2.6, 0.8 + n * 0.12) + (i % 2) * 0.35; moveAvatar(id, Math.cos(a) * r, Math.sin(a) * r); setMood(id, null); });
}
// cada aluno pula para a plataforma escolhida
export function padLayout(choices) { // {id: choice}
  const per = [0, 0, 0, 0, 0];
  for (const [id, c] of Object.entries(choices)) {
    if (c < 0) { const k = per[4]++; moveAvatar(id, Math.cos(k) * 1.2, Math.sin(k) * 1.2); continue; }
    const k = per[c]++, ang = k * 2.4, r = Math.min(1.7, 0.45 * Math.sqrt(k));
    moveAvatar(id, PAD_POS[c][0] + Math.cos(ang) * r, PAD_POS[c][1] + Math.sin(ang) * r);
  }
}
export function revealPads(correct) {
  pads.forEach((p, i) => { p.userData.y = correct < 0 ? 0 : i === correct ? 0.35 : -0.5; p.userData.light.intensity = i === correct ? 40 : 0; p.userData.icon.material.opacity = correct < 0 || i === correct ? 1 : 0.25; });
  if (correct >= 0) { beam.position.x = PAD_POS[correct][0]; beam.position.z = PAD_POS[correct][1]; beam.material.opacity = 0.16; } else beam.material.opacity = 0;
}
export function padsVisible(v) { pads.forEach((p) => (p.visible = v)); }

export function showPodium(top) { // [id1, id2, id3]
  podium.visible = true; padsVisible(false);
  const spots = [[0, 2.2], [-2.3, 1.5], [2.3, 1.0]];
  top.forEach((id, i) => { const a = avatars.get(id); if (!a) return; a.position.set(spots[i][0], spots[i][1], 0); a.userData.target.copy(a.position); a.rotation.y = 0; a.userData.podium = true; setMood(id, 'happy'); });
  let k = 0;
  for (const [id, a] of avatars) if (!top.includes(id)) { const ang = Math.PI + 0.4 + (k++ * 0.33); a.userData.podium = false; moveAvatar(id, Math.cos(ang) * 6.5, Math.sin(ang) * 3 + 3.5); }
  burstConfetti();
}
export function hidePodium() { podium.visible = false; padsVisible(true); for (const a of avatars.values()) a.userData.podium = false; }

export function burstConfetti(at = { x: 0, z: 0 }) {
  confetti.visible = true; confettiT = 5;
  for (const p of confetti.userData.p) { p.pos.set(at.x + R(-3, 3), R(6, 14), at.z + R(-3, 3)); p.vel.set(R(-3, 3), R(-1, 5), R(-3, 3)); p.rot.set(R(0, 6), R(0, 6), 0); }
}

// ---------- loop ----------
const dummy = new THREE.Object3D();
function tick() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  // câmera
  let tp, tl;
  if (camMode === 'orbit') { tp = [Math.sin(t * 0.08) * 26, 11, Math.cos(t * 0.08) * 26]; tl = [0, 0, 0]; }
  else if (camMode === 'custom') { const wide = innerWidth > innerHeight; tp = [0, 2.6, wide ? 5.4 : 11]; tl = wide ? [1.7, 1.5, 0] : [0, -1.9, 0]; }
  else if (camMode === 'lobby') { tp = [Math.sin(t * 0.15) * 3, 10.5, 14.5]; tl = [0, 0, 0]; }
  else if (camMode === 'question') { tp = [0, 14.5, 14]; tl = [0, 0, -0.2]; }
  else if (camMode === 'podium') { tp = [Math.sin(t * 0.3) * 1.5, 3.4, 11]; tl = [0, -0.6, 0]; }
  if (camMode !== 'custom' && camera.aspect < 1) { const f = Math.min(2.2, 0.75 / camera.aspect); tp = tp.map((v, i) => tl[i] + (v - tl[i]) * f); }
  camPos.lerp(new THREE.Vector3(...tp), 1 - Math.pow(0.02, dt)); camLookT.set(...tl); camLook.lerp(camLookT, 1 - Math.pow(0.02, dt));
  camera.position.copy(camPos); camera.lookAt(camLook);

  for (const f of floaters) { f.position.y = f.userData.y + Math.sin(t * f.userData.sp + f.userData.ph) * 1.2; if (f.isGroup) { f.rotation.y += dt * f.userData.sp; f.rotation.x = Math.sin(t * 0.5 + f.userData.ph) * 0.4; } }
  for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 80) c.position.x = -80; }
  for (const p of pads) { p.position.y += (p.userData.y - p.position.y) * Math.min(1, dt * 6); p.userData.icon.position.y = 2.3 + Math.sin(t * 2 + p.position.x) * 0.15; }
  beam.material.opacity *= 0.995; beam.rotation.y += dt;
  if (marker.material.opacity > 0) { marker.material.opacity -= dt * 1.5; marker.scale.multiplyScalar(1 + dt * 2); }

  for (const a of avatars.values()) animateAvatar(a, dt, t);

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i], u = b.userData; u.t += dt;
    b.position.y += dt * (u.fast ? 2 : 0.9); b.material.opacity = Math.max(0, 1 - u.t / (u.fast ? 0.7 : 2.2));
    if (!u.fast) b.scale.setScalar(1.5 * Math.min(1, u.t * 6) * (1 + Math.sin(u.t * 10) * 0.05));
    if (u.t > (u.fast ? 0.7 : 2.2)) { scene.remove(b); b.material.map.dispose(); b.material.dispose(); bubbles.splice(i, 1); }
  }
  if (confettiT > 0) {
    confettiT -= dt; const ps = confetti.userData.p;
    for (let i = 0; i < ps.length; i++) { const p = ps[i]; p.vel.y -= 4 * dt; p.vel.multiplyScalar(0.985); p.pos.addScaledVector(p.vel, dt); p.rot.x += p.spin * dt; p.rot.y += p.spin * dt * 0.7; dummy.position.copy(p.pos); dummy.rotation.copy(p.rot); dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix); }
    confetti.instanceMatrix.needsUpdate = true; if (confettiT <= 0) confetti.visible = false;
  }
  renderer.render(scene, camera);
}

function animateAvatar(a, dt, t) {
  const u = a.userData, rig = u.rig, [al, ar] = u.arms;
  const d = new THREE.Vector3().subVectors(u.target, a.position); d.y = 0; const dist = d.length();
  rig.position.y = 0; rig.rotation.set(0, 0, 0); rig.scale.set(1, 1, 1); al.rotation.set(0, 0, 0.25); ar.rotation.set(0, 0, -0.25);
  if (dist > 0.05) {
    const sp = Math.min(dist, (dist > 4 ? 9 : 5) * dt); a.position.addScaledVector(d.normalize(), sp);
    const want = Math.atan2(d.x, d.z); let diff = want - a.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); a.rotation.y += diff * Math.min(1, dt * 10);
    const ph = t * 14; rig.position.y = Math.abs(Math.sin(ph)) * (dist > 4 ? 0.5 : 0.15); al.rotation.x = Math.sin(ph) * 0.8; ar.rotation.x = -Math.sin(ph) * 0.8;
  } else {
    rig.position.y = Math.sin(t * 2.5 + u.phase) * 0.03; rig.scale.y = 1 + Math.sin(t * 2.5 + u.phase) * 0.02;
    if (u.podium) a.rotation.y += (0 - a.rotation.y) * dt * 5;
  }
  if (u.mood === 'happy') { u.moodT += dt; rig.position.y += Math.abs(Math.sin(u.moodT * 7)) * 0.6; al.rotation.z = 2.6; ar.rotation.z = -2.6; }
  if (u.mood === 'sad') { u.moodT += dt; rig.rotation.x = 0.25; u.head.rotation.z = Math.sin(t * 6) * 0.25; al.rotation.z = 0.1; ar.rotation.z = -0.1; } else u.head.rotation.z = 0;
  const e = u.emote;
  if (e) {
    e.t += dt; const k = e.t;
    if (e.i === 0) { ar.rotation.z = -2.6 + Math.sin(k * 16) * 0.4; }
    if (e.i === 1) { rig.rotation.y = k * 9; rig.position.y += Math.abs(Math.sin(k * 10)) * 0.3; al.rotation.z = 2.4; ar.rotation.z = -2.4; }
    if (e.i === 2) { rig.rotation.z = Math.sin(k * 30) * 0.12; rig.rotation.x = -0.2; al.rotation.z = 1; ar.rotation.z = -1; }
    if (e.i === 3 || e.i === 5) { rig.position.y += Math.abs(Math.sin(k * 6)) * 0.9; rig.scale.y = 1 + Math.sin(k * 12) * 0.12; al.rotation.z = 2.8; ar.rotation.z = -2.8; }
    if (e.i === 4) { rig.scale.setScalar(1 + Math.abs(Math.sin(k * 8)) * 0.12); al.rotation.x = -1.4; ar.rotation.x = -1.4; al.rotation.z = -0.3; ar.rotation.z = 0.3; }
    if (e.i === 6) { rig.rotation.y = Math.min(1, k * 1.5) * Math.PI * 2; rig.rotation.z = 0.15; ar.rotation.z = -1.5; }
    if (e.i === 7) { rig.rotation.x = 0.35; rig.position.y += Math.sin(k * 25) * 0.04; al.rotation.x = -2.2; ar.rotation.x = -2.2; }
    if (e.t > 1.8) u.emote = null;
  }
  if (u.spin && dist <= 0.05 && !e) a.rotation.y += dt * u.spin;
  if (u.prop) u.prop.rotation.y += dt * 18;
  if (u.cape) u.cape.rotation.x = 0.15 + (dist > 0.05 ? 0.5 : 0) + Math.sin(t * 6) * 0.06;
  if (u.wings) u.wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * (dist > 0.05 ? 18 : 4)) * 0.3)));
}
