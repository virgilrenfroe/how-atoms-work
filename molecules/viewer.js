import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const VOID = 0x140818;
const SATIN = { metalness: 0.32, roughness: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.38 };
const CPK = {
  H: 0xffffff,
  C: 0x909090,
  N: 0x3050f8,
  O: 0xff0d0d,
  F: 0x90e050,
  P: 0xff8000,
  S: 0xffff30,
  Cl: 0x1ff01f,
  Mg: 0x8aff00,
  Fe: 0xe06633,
  Na: 0xab5cf2,
};
const RADIUS = { H: 0.22, C: 0.4, N: 0.38, O: 0.36, F: 0.32, P: 0.42, S: 0.42, Cl: 0.44 };
const SHOW = 1.15;

const LABEL_INK = {
  H: "#140818",
  C: "#efe6f2",
  N: "#efe6f2",
  O: "#efe6f2",
  F: "#140818",
  P: "#140818",
  S: "#140818",
  Cl: "#140818",
};

function fail(msg) {
  const err = new Error(msg);
  err.student = true;
  throw err;
}

export function createViewer(container) {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 800px)").matches;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const params = new URLSearchParams(location.search);
  let still = motionQuery.matches || params.has("still");
  let alive = true;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: isIOS ? "default" : "high-performance",
    });
    if (!renderer.getContext()) fail("no-gl");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (renderer.getPixelRatio() > 1.5) fail("DPR cap");
  } catch (e) {
    return { ok: false, error: e };
  }
  renderer.setClearColor(VOID, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = "gl";
  container.appendChild(renderer.domElement);

  const gl = renderer.getContext();
  const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
  const useAnisotropy = !isMobile && isWebGL2;

  function makeSatin(color, emissiveIntensity) {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: SATIN.metalness,
      roughness: SATIN.roughness,
      clearcoat: SATIN.clearcoat,
      clearcoatRoughness: SATIN.clearcoatRoughness,
      emissive: color,
      emissiveIntensity,
      anisotropy: useAnisotropy ? 0.55 : 0,
    });
    if (useAnisotropy) mat.anisotropyRotation = Math.PI / 2;
    if (mat.metalness !== 0.32 || mat.roughness !== 0.45 || mat.clearcoat !== 0.22) {
      fail("satin params drifted");
    }
    if (isMobile && mat.anisotropy !== 0) fail("mobile anisotropy must be off");
    return mat;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.48;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc4b8e0, 0x2a1218, 0.55));
  const key = new THREE.PointLight(0xffb36b, 1.45, 80, 2);
  key.position.set(6, 8, 9);
  scene.add(key);
  const fill = new THREE.PointLight(0x6a8cff, 0.28, 60, 2);
  fill.position.set(-8, -2, -4);
  scene.add(fill);

  const sphereW = isMobile ? 24 : 32;
  const sphereH = isMobile ? 20 : 28;
  const sphereGeo = new THREE.SphereGeometry(1, sphereW, sphereH);
  const bondGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, isMobile ? 6 : 10);
  const UP = new THREE.Vector3(0, 1, 0);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 200);
  camera.position.set(0.6, 1.4, 8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isMobile;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 48;
  controls.target.set(0, 0, 0);

  const satinCache = new Map();
  function satinFor(el, glow) {
    const key = el + ":" + glow;
    if (!satinCache.has(key)) {
      const color = CPK[el] ?? 0xc8b8d4;
      satinCache.set(key, makeSatin(color, glow));
    }
    return satinCache.get(key);
  }

  const labelCache = new Map();
  function labelSprite(el) {
    if (!labelCache.has(el)) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const g = canvas.getContext("2d");
      g.clearRect(0, 0, 128, 128);
      g.font = '700 78px "Space Mono", ui-monospace, monospace';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = LABEL_INK[el] || "#efe6f2";
      g.fillText(el, 64, 70);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
      labelCache.set(el, mat);
    }
    const sprite = new THREE.Sprite(labelCache.get(el));
    sprite.scale.set(0.46, 0.46, 1);
    return sprite;
  }

  let mol = null;
  const atomMeshes = [];
  let current = null;
  let dragging = false;
  controls.addEventListener("start", () => { dragging = true; });
  controls.addEventListener("end", () => { dragging = false; });

  function clearMol() {
    if (!mol) return;
    scene.remove(mol);
    mol.traverse((obj) => {
      if (obj.geometry && obj.geometry !== sphereGeo && obj.geometry !== bondGeo) obj.geometry.dispose();
    });
    mol = null;
    atomMeshes.length = 0;
  }

  function addHalf(parent, from, to, material, lateral) {
    const delta = new THREE.Vector3().subVectors(to, from);
    const length = delta.length();
    if (length < 1e-4) return;
    const dir = delta.multiplyScalar(1 / length);
    const mesh = new THREE.Mesh(bondGeo, material);
    mesh.scale.set(1, length, 1);
    const mid = from.clone().addScaledVector(dir, length * 0.5);
    if (lateral) mid.add(lateral);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(UP, dir);
    parent.add(mesh);
  }

  function laterals(dir, order) {
    if (order !== 2 && order !== 3) return [new THREE.Vector3()];
    let perp = new THREE.Vector3(0, 1, 0).cross(dir);
    if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3(1, 0, 0).cross(dir);
    perp.normalize();
    const gap = 0.09;
    if (order === 2) return [perp.clone().multiplyScalar(gap), perp.clone().multiplyScalar(-gap)];
    const bit = new THREE.Vector3().crossVectors(dir, perp).normalize();
    return [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      return perp.clone().multiplyScalar(Math.cos(a) * gap).addScaledVector(bit, Math.sin(a) * gap);
    });
  }

  function show(geo) {
    clearMol();
    current = geo;
    mol = new THREE.Group();
    const positions = geo.atoms.map((a) => new THREE.Vector3(a.x * SHOW, a.y * SHOW, a.z * SHOW));
    geo.atoms.forEach((a, i) => {
      const color = CPK[a.el] ?? 0xc8b8d4;
      const mesh = new THREE.Mesh(sphereGeo, satinFor(a.el, a.el === "O" ? 0.1 : a.el === "H" ? 0.08 : 0.05));
      const r = RADIUS[a.el] ?? 0.36;
      mesh.scale.setScalar(r);
      mesh.position.copy(positions[i]);
      mesh.userData.index = i;
      mesh.userData.base = r;
      mesh.userData.el = a.el;
      const lab = labelSprite(a.el);
      lab.position.y = r * 0.15;
      mesh.add(lab);
      mol.add(mesh);
      atomMeshes.push(mesh);
    });
    for (const [i, j, order] of geo.bonds) {
      const from = positions[i];
      const to = positions[j];
      const dir = to.clone().sub(from);
      const len = dir.length();
      if (len < 1e-4) continue;
      dir.multiplyScalar(1 / len);
      const drawOrder = order === 2 || order === 3 ? order : 1;
      for (const lateral of laterals(dir, drawOrder)) {
        const a = from.clone().add(lateral);
        const b = to.clone().add(lateral);
        const mid = a.clone().lerp(b, 0.5);
        addHalf(mol, a, mid, satinFor(geo.atoms[i].el, 0.03), null);
        addHalf(mol, mid, b, satinFor(geo.atoms[j].el, 0.03), null);
      }
    }
    scene.add(mol);
    const box = new THREE.Box3().setFromObject(mol);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    controls.target.copy(sphere.center);
    const dist = Math.max(3.2, sphere.radius / Math.tan((camera.fov * Math.PI) / 360) * 0.92);
    camera.position.set(sphere.center.x + dist * 0.15, sphere.center.y + dist * 0.22, sphere.center.z + dist);
    camera.near = Math.max(0.05, dist / 80);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.minDistance = Math.max(1.6, sphere.radius * 0.8);
    controls.maxDistance = dist * 3.2;
    controls.update();
    if (still && mol) mol.rotation.set(0.2, 0.55, 0.04);
    select(null);
  }

  function select(mesh) {
    for (const m of atomMeshes) {
      const on = m === mesh;
      m.scale.setScalar(m.userData.base * (on ? 1.12 : 1));
    }
    return mesh ? mesh.userData.index : null;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let ptr = null;
  let pickHandler = () => {};
  renderer.domElement.addEventListener("pointerdown", (e) => {
    ptr = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!ptr) return;
    const moved = Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y);
    ptr = null;
    if (moved > 8) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(atomMeshes, false)[0];
    const index = select(hit ? hit.object : null);
    pickHandler(index);
    if (still) renderer.render(scene, camera);
  });

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, isMobile);
    if (still) renderer.render(scene, camera);
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let visible = true;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (mol && !still && !dragging) mol.rotation.y += dt * 0.22;
    controls.update();
    renderer.render(scene, camera);
  }
  function start() {
    if (!alive) return;
    if (still) {
      cancelAnimationFrame(raf);
      controls.update();
      renderer.render(scene, camera);
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  motionQuery.addEventListener("change", (e) => {
    still = e.matches || params.has("still");
    controls.enableDamping = !still && !isMobile;
    start();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else start();
  });

  new ResizeObserver(resize).observe(container);
  resize();
  start();

  return {
    ok: true,
    show,
    resize,
    setVisible(v) {
      visible = v;
      renderer.domElement.style.visibility = v ? "visible" : "hidden";
      if (v) start();
    },
    onPick(fn) { pickHandler = fn; },
    elements() {
      return [...new Set((current?.atoms || []).map((a) => a.el))];
    },
  };
}

export function bondRecords(geo) {
  return geo.bonds.map(([i, j, order]) => {
    const a = geo.atoms[i];
    const b = geo.atoms[j];
    const angstrom = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    return { i, j, order, elA: a.el, elB: b.el, angstrom };
  });
}

export function angleAt(geo, index) {
  const bonds = geo.bonds.filter(([i, j]) => i === index || j === index);
  if (bonds.length !== 2) return null;
  const other = (bond) => (bond[0] === index ? bond[1] : bond[0]);
  const o1 = geo.atoms[other(bonds[0])];
  const o2 = geo.atoms[other(bonds[1])];
  const c = geo.atoms[index];
  const v1 = [o1.x - c.x, o1.y - c.y, o1.z - c.z];
  const v2 = [o2.x - c.x, o2.y - c.y, o2.z - c.z];
  const n1 = Math.hypot(...v1);
  const n2 = Math.hypot(...v2);
  const dot = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2);
  return Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
}
