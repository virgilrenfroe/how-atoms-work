import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GEOMETRY } from './geometry.js';

// ---------- constants (chemistry values are cited in NOTES.md) ----------
const VOID = 0x1d0c23;
const COLORS = {
  proton: 0xff6b3d, neutron: 0x6c84a8, electron: 0x5fd6c6,
  H: 0xffffff, C: 0x55555c, N: 0x3050f8, O: 0xff0d0d, Na: 0xab5cf2, Cl: 0x1ff01f,
};
const EN = { H: 2.2, C: 2.55, N: 3.04, O: 3.44, Na: 0.93, Cl: 3.16 };
const NACL_A = 5.64;            // Å, conventional cubic cell edge (Fm-3m)
const NACL_D = NACL_A / 2;      // Å, nearest Na–Cl distance = 2.820
const R_NA = 1.02, R_CL = 1.81; // Å, Shannon ionic radii (CN 6)
const ION_DRAW = 0.42;          // spheres drawn at 42% of ionic radius so the inside is visible
const ATOM_DRAW = { H: 0.26, C: 0.34, N: 0.33, O: 0.33 }; // display radii, Å (not van der Waals)
const MOL_SCALE = 1.6;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 720px)').matches;
const SEG = isMobile ? [24, 20] : [32, 28];
const ESEG = isMobile ? [16, 14] : [24, 20];

// ---------- shared helpers ----------
function satin(renderer, color, emissive = 0.06) {
  const gl = renderer.getContext();
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const aniso = !isMobile && webgl2;
  const m = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.32, roughness: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.38,
    emissive: color, emissiveIntensity: emissive,
    anisotropy: aniso ? 0.55 : 0,
  });
  if (aniso) m.anisotropyRotation = Math.PI / 2;
  return m;
}
const electronMat = new THREE.MeshBasicMaterial({ color: COLORS.electron });
const electronGeo = new THREE.SphereGeometry(1, ESEG[0], ESEG[1]);
const sphereGeo = new THREE.SphereGeometry(1, SEG[0], SEG[1]);
const stickGeo = new THREE.CylinderGeometry(1, 1, 1, isMobile ? 8 : 14);

function ringLine(radius, opacity = 0.16) {
  const pts = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color: COLORS.electron, transparent: true, opacity, depthWrite: false });
  return new THREE.LineLoop(g, m);
}
function electron(size) {
  const e = new THREE.Mesh(electronGeo, electronMat);
  e.scale.setScalar(size);
  return e;
}
function stick(a, b, radius, mat) {
  const m = new THREE.Mesh(stickGeo, mat);
  const d = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(radius, d.length(), radius);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return m;
}
function perpendicular(v) {
  // prefer an offset that lies in the screen plane, so double and triple sticks read side by side
  const t = Math.abs(v.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(v, t).normalize();
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------- stage: one renderer per lesson scene ----------
const stages = [];
function makeStage(el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: isIOS ? 'default' : 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(VOID, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc4b8e0, 0x2a1218, 0.6));
  const key = new THREE.PointLight(0xffb36b, 1.5, 60, 1.6);
  key.position.set(5, 6, 8);
  scene.add(key);
  const fill = new THREE.PointLight(0x6a8cff, 0.4, 50, 2);
  fill.position.set(-6, -2, -4);
  scene.add(fill);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 0, 14);
  let controls = null;
  if (!isMobile) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    renderer.domElement.style.cursor = 'grab';
  } else {
    renderer.domElement.style.touchAction = 'pan-y';
  }
  const st = { el, renderer, scene, camera, controls, labels: [], visible: false, fit: { w: 5, h: 5 }, update: null, size: [1, 1] };
  st.label = (text, cls = '') => {
    const d = document.createElement('span');
    d.className = 'lbl ' + cls;
    d.textContent = text;
    el.appendChild(d);
    const L = { el: d, obj: null, offset: new THREE.Vector3(), px: [0, 0], on: true };
    st.labels.push(L);
    return L;
  };
  st.resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    st.size = [w, h];
    camera.aspect = w / h;
    renderer.setSize(w, h, isMobile);
    st.refit();
  };
  st.refit = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(st.fit.h / t, st.fit.w / (t * camera.aspect)) * 1.12;
    const dir = camera.position.clone().sub(controls ? controls.target : new THREE.Vector3());
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    camera.position.copy(dir.normalize().multiplyScalar(dist));
    camera.near = dist / 20; camera.far = dist * 6;
    camera.updateProjectionMatrix();
    if (controls) controls.update();
  };
  const v = new THREE.Vector3();
  st.render = () => {
    if (controls) controls.update();
    renderer.render(scene, camera);
    const [w, h] = st.size;
    for (const L of st.labels) {
      if (!L.on || !L.obj || !L.obj.visible) { L.el.style.display = 'none'; continue; }
      L.obj.getWorldPosition(v).add(L.offset);
      v.project(camera);
      if (v.z > 1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      L.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%)`;
    }
  };
  new ResizeObserver(st.resize).observe(el);
  new IntersectionObserver((ents) => { for (const e of ents) st.visible = e.isIntersecting; }, { rootMargin: '120px' }).observe(el);
  stages.push(st);
  return st;
}

// ---------- scene 1: ionic (Bohr shells, transfer, rock-salt crystal) ----------
function packNucleus(Z, N, r) {
  const A = Z + N;
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const R = r * Math.cbrt(A) * 1.12;
  for (let i = 0; i < A; i++) {
    const y = 1 - (i / (A - 1 || 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const s = R * Math.cbrt((i + 0.5) / A);
    pts.push(new THREE.Vector3(Math.cos(th) * rad * s, y * s, Math.sin(th) * rad * s));
  }
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < A; i++) {
      for (let j = i + 1; j < A; j++) {
        const d = pts[j].clone().sub(pts[i]);
        const L = d.length() || 1e-3;
        const min = 2 * r * 1.06;
        if (L < min) {
          d.multiplyScalar((min - L) / L / 2);
          pts[i].sub(d); pts[j].add(d);
        }
      }
      pts[i].multiplyScalar(0.985);
    }
  }
  return pts.map((p, i) => ({ p, proton: Math.floor(((i + 1) * Z) / A) > Math.floor((i * Z) / A) }));
}

function buildIonic(st) {
  const { scene, renderer } = st;
  const root = new THREE.Group();
  scene.add(root);
  const matP = satin(renderer, COLORS.proton, 0.08);
  const matN = satin(renderer, COLORS.neutron, 0.05);
  const SHELL_R = [0.95, 1.6, 2.25];
  const SEP = 3.25;
  const atomsGroup = new THREE.Group();
  root.add(atomsGroup);

  // Na: 11 p, 12 n (Na-23). Cl: 17 p, 18 n (Cl-35, the most common isotope).
  function makeAtom(sym, Z, N, x) {
    const g = new THREE.Group();
    g.position.x = x;
    for (const { p, proton } of packNucleus(Z, N, 0.11)) {
      const m = new THREE.Mesh(sphereGeo, proton ? matP : matN);
      m.position.copy(p); m.scale.setScalar(0.11);
      g.add(m);
    }
    const rings = SHELL_R.map((r) => { const ring = ringLine(r); g.add(ring); return ring; });
    atomsGroup.add(g);
    return { sym, Z, g, rings, shells: [[], [], []], phase: [0, 0.6, 1.2] };
  }
  const na = makeAtom('Na', 11, 12, -SEP);
  const cl = makeAtom('Cl', 17, 18, SEP);

  function setShells(atom, counts) {
    atom.shells.forEach((arr) => { arr.forEach((e) => atom.g.remove(e)); arr.length = 0; });
    counts.forEach((n, k) => {
      for (let i = 0; i < n; i++) { const e = electron(0.085); atom.g.add(e); atom.shells[k].push(e); }
    });
    atom.rings.forEach((r, k) => { r.visible = k < counts.length; });
  }
  const SPEED = [0.9, 0.55, 0.36];
  function placeElectrons(atom, t) {
    atom.shells.forEach((arr, k) => {
      const n = arr.length;
      arr.forEach((e, i) => {
        const a = atom.phase[k] + t * SPEED[k] + (i / n) * Math.PI * 2;
        e.position.set(Math.cos(a) * SHELL_R[k], Math.sin(a) * SHELL_R[k], 0);
      });
    });
  }

  const lblNa = st.label('Na', 'big'); lblNa.obj = na.g; lblNa.offset.set(0, -3.0, 0);
  const lblCl = st.label('Cl', 'big'); lblCl.obj = cl.g; lblCl.offset.set(0, -3.0, 0);
  const lblNaS = st.label('', 'dim'); lblNaS.obj = na.g; lblNaS.offset.set(0, -3.65, 0);
  const lblClS = st.label('', 'dim'); lblClS.obj = cl.g; lblClS.offset.set(0, -3.65, 0);

  // Rock-salt chunk: one conventional cubic cell, 3 × 3 × 3 ion sites, spacing a/2.
  const crystal = new THREE.Group();
  const lattice = new THREE.Group();
  const S = 1.0; // 1 Å = 1 scene unit
  const matNa = satin(renderer, COLORS.Na, 0.1);
  const matCl = satin(renderer, COLORS.Cl, 0.06);
  const matStick = new THREE.MeshStandardMaterial({ color: 0xcfc4d6, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.55 });
  const site = (i, j, k) => new THREE.Vector3((i - 1) * NACL_D * S, (j - 1) * NACL_D * S, (k - 1) * NACL_D * S);
  let nNa = 0, nCl = 0;
  let firstNa = null, firstCl = null;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    const isNa = (i + j + k) % 2 === 0; // Na at (0,0,0) + fcc; Cl at (½,½,½) + fcc
    const m = new THREE.Mesh(sphereGeo, isNa ? matNa : matCl);
    m.position.copy(site(i, j, k));
    m.scale.setScalar((isNa ? R_NA : R_CL) * ION_DRAW * S);
    lattice.add(m);
    if (isNa) { nNa++; if (!firstNa && i === 1 && j === 1 && k === 0) firstNa = m; }
    else { nCl++; if (!firstCl && i === 1 && j === 1 && k === 1) firstCl = m; }
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      if (i + di < 3 && j + dj < 3 && k + dk < 3) lattice.add(stick(site(i, j, k), site(i + di, j + dj, k + dk), 0.045, matStick));
    }
  }
  crystal.add(lattice);
  lattice.rotation.set(0.42, -0.62, 0);
  crystal.visible = false;
  root.add(crystal);
  const lblA = st.label(`cell edge a = ${NACL_A.toFixed(3)} Å`, 'dim');
  const edgeAnchor = new THREE.Object3D(); edgeAnchor.position.set(0, -NACL_D * 1.0, NACL_D * 1.0); lattice.add(edgeAnchor);
  lblA.obj = edgeAnchor; lblA.offset.set(0, -0.9, 0);
  const lblCrys = st.label(`Na⁺ ${nNa} · Cl⁻ ${nCl} shown`, 'dim');
  const topAnchor = new THREE.Object3D(); topAnchor.position.set(0, NACL_D * 1.6, 0); crystal.add(topAnchor);
  lblCrys.obj = topAnchor;

  const say = document.getElementById('ionic-say');
  const read = document.getElementById('ionic-read');
  const cap = document.getElementById('ionic-cap');
  const capShell = cap.textContent;
  const STEPS = [
    {
      say: 'A sodium atom and a chlorine atom. Both are neutral: each has as many electrons as protons.',
      na: [2, 8, 1], cl: [2, 8, 7], naL: 'Na', clL: 'Cl',
      rows: [['', 'Sodium', 'Chlorine'], ['Protons', '11', '17'], ['Electrons', '11', '17'], ['Shells', '2, 8, 1', '2, 8, 7'], ['Charge', '0', '0']],
    },
    {
      say: 'Sodium’s single outer electron moves across to chlorine’s outer shell.',
      na: [2, 8, 1], cl: [2, 8, 7], naL: 'Na', clL: 'Cl',
      rows: [['', 'Sodium', 'Chlorine'], ['Protons', '11', '17'], ['Electrons', '11 → 10', '17 → 18'], ['Shells', '2, 8, 1 → 2, 8', '2, 8, 7 → 2, 8, 8'], ['Charge', '0 → +1', '0 → −1']],
    },
    {
      say: 'Now both have full outer shells. Sodium is a sodium ion, Na⁺, with the same electrons as neon. Chlorine is a chloride ion, Cl⁻, with the same electrons as argon.',
      na: [2, 8], cl: [2, 8, 8], naL: 'Na⁺', clL: 'Cl⁻',
      rows: [['', 'Na⁺', 'Cl⁻'], ['Protons', '11', '17'], ['Electrons', '10', '18'], ['Shells', '2, 8', '2, 8, 8'], ['Charge', '+1', '−1']],
    },
    {
      say: 'Real salt is not single pairs. Ions stack in a cube pattern. Each Na⁺ has six Cl⁻ as its nearest neighbors, and each Cl⁻ has six Na⁺.',
      rows: [['', 'Salt crystal', ''], ['Pattern', 'rock salt (cubic)', ''], ['Cell edge', '5.640 Å', ''], ['Na⁺ to Cl⁻', '2.820 Å', ''], ['Ratio', '1 Na⁺ : 1 Cl⁻', '']],
    },
  ];
  let step = -1, flight = null, t0 = 0;
  const flyer = electron(0.085);
  flyer.visible = false;
  root.add(flyer);
  function table(rows) {
    read.innerHTML = rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 || j === 0 ? `<th>${c}</th>` : `<td><b>${c}</b></td>`)).join('')}</tr>`).join('');
  }
  function set(k) {
    step = k;
    const s = STEPS[k];
    say.textContent = s.say;
    table(s.rows);
    const crystalOn = k === 3;
    crystal.visible = crystalOn;
    atomsGroup.visible = !crystalOn;
    [lblNa, lblCl, lblNaS, lblClS].forEach((L) => { L.on = !crystalOn; });
    [lblA, lblCrys].forEach((L) => { L.on = crystalOn; });
    cap.textContent = crystalOn
      ? 'One cubic cell of salt. Spheres are drawn smaller than the real ions so you can see inside. Na⁺ is smaller than Cl⁻.'
      : capShell;
    flyer.visible = false; flight = null;
    if (crystalOn) {
      st.fit = { w: 5.6, h: 5.6 };
    } else {
      st.fit = { w: SEP + SHELL_R[2] + 0.5, h: 4.3 };
      setShells(na, s.na); setShells(cl, s.cl);
      lblNa.el.textContent = s.naL; lblCl.el.textContent = s.clL;
      lblNa.el.className = 'lbl big' + (k === 2 ? ' pos' : '');
      lblCl.el.className = 'lbl big' + (k === 2 ? ' neg' : '');
      lblNaS.el.textContent = s.na.join(', ');
      lblClS.el.textContent = s.cl.join(', ');
      if (k === 1) {
        flight = { t: 0, dur: reduceMotion ? 0.01 : 2.4 };
        const e = na.shells[2].pop(); na.g.remove(e);
      }
    }
    st.refit();
  }
  st.setStep = set;
  st.update = (dt, t) => {
    if (crystal.visible) {
      if (!reduceMotion) lattice.rotation.y += dt * 0.22;
      return;
    }
    placeElectrons(na, reduceMotion ? 0 : t);
    placeElectrons(cl, reduceMotion ? 0 : t);
    if (flight) {
      flight.t += dt / flight.dur;
      const u = ease(Math.min(1, flight.t));
      const a0 = na.phase[2] + t * SPEED[2];
      const from = new THREE.Vector3(Math.cos(a0) * SHELL_R[2] - SEP, Math.sin(a0) * SHELL_R[2], 0);
      const to = new THREE.Vector3(SEP - SHELL_R[2], 0, 0);
      const mid = new THREE.Vector3(0, 2.1, 0.6);
      flyer.visible = true;
      flyer.position.set(0, 0, 0)
        .addScaledVector(from, (1 - u) * (1 - u))
        .addScaledVector(mid, 2 * u * (1 - u))
        .addScaledVector(to, u * u);
      na.rings[2].material.opacity = 0.16 * (1 - u);
      if (flight.t >= 1) {
        flight = null; flyer.visible = false;
        na.rings[2].material.opacity = 0.16;
        setShells(na, [2, 8]);
        setShells(cl, [2, 8, 8]);
        lblNaS.el.textContent = '2, 8'; lblClS.el.textContent = '2, 8, 8';
        lblNa.el.textContent = 'Na⁺'; lblCl.el.textContent = 'Cl⁻';
        lblNa.el.className = 'lbl big pos'; lblCl.el.className = 'lbl big neg';
      }
    }
  };
  set(0);
}

// ---------- molecules from PubChem conformers ----------
function buildMolecule(st, id, opts = {}) {
  const geo = GEOMETRY[id];
  const g = new THREE.Group();
  const pos = geo.atoms.map(([, x, y, z]) => new THREE.Vector3(x, y, z));
  const c = pos.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pos.length);
  pos.forEach((p) => p.sub(c).multiplyScalar(MOL_SCALE));
  if (opts.align) opts.align(pos, geo);
  const mats = {};
  const mat = (el) => (mats[el] ||= satin(st.renderer, COLORS[el], el === 'H' ? 0.04 : el === 'C' ? 0.02 : 0.08));
  const atomMeshes = geo.atoms.map(([el], i) => {
    const m = new THREE.Mesh(sphereGeo, mat(el));
    m.position.copy(pos[i]);
    m.scale.setScalar(ATOM_DRAW[el] * MOL_SCALE);
    g.add(m);
    return m;
  });
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8cfe0, roughness: 0.55, metalness: 0.15 });
  const pairs = [];
  for (const [i, j, order] of geo.bonds) {
    const a = pos[i], b = pos[j];
    const axis = new THREE.Vector3().subVectors(b, a).normalize();
    const side = perpendicular(axis);
    const gap = 0.13;
    for (let k = 0; k < order; k++) {
      const off = side.clone().multiplyScalar((k - (order - 1) / 2) * gap);
      g.add(stick(a.clone().add(off), b.clone().add(off), order === 1 ? 0.055 : 0.04, stickMat));
    }
    // one ring of two electrons per shared pair
    const bias = opts.bias ? opts.bias(geo.atoms[i][0], geo.atoms[j][0]) : 0.5; // fraction from atom i toward j
    const L = a.distanceTo(b);
    for (let k = 0; k < order; k++) {
      const along = (k - (order - 1) / 2) * 0.2;
      const center = a.clone().addScaledVector(axis, L * bias + along);
      const holder = new THREE.Group();
      holder.position.copy(center);
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      const r = 0.34;
      holder.add(ringLine(r, 0.2));
      const e1 = electron(0.07), e2 = electron(0.07);
      holder.add(e1, e2);
      g.add(holder);
      pairs.push({ e1, e2, r, phase: k * 1.1 + pairs.length * 0.7 });
    }
  }
  g.userData = { pos, atomMeshes, pairs };
  return g;
}
function spinPairs(g, t) {
  for (const p of g.userData.pairs) {
    const a = p.phase + t * 1.6;
    p.e1.position.set(Math.cos(a) * p.r, Math.sin(a) * p.r, 0);
    p.e2.position.set(-Math.cos(a) * p.r, -Math.sin(a) * p.r, 0);
  }
}

// ---------- scene 2: covalent ----------
const COV = {
  H2: {
    say: 'Each hydrogen brings one electron. They share them as one pair, a single bond. Now each hydrogen counts 2 electrons, a full first shell like helium.',
    rows: [['Molecule', 'Hydrogen, H₂'], ['Shared pairs', '1 (single bond, H–H)'], ['Bond length', '0.741 Å (measured)'], ['Outer shell after sharing', 'H: 2 each']],
  },
  CH4: {
    say: 'Carbon has 4 outer electrons and needs 4 more. It shares one pair with each of four hydrogens. The four bonds spread out into a tetrahedron, 109.5° apart.',
    rows: [['Molecule', 'Methane, CH₄'], ['Shared pairs', '4 (four single bonds, C–H)'], ['Bond length', 'C–H 1.087 Å (measured)'], ['Angle', 'H–C–H 109.5°'], ['Outer shell after sharing', 'C: 8 · H: 2 each']],
  },
  O2: {
    say: 'Each oxygen has 6 outer electrons. They share two pairs, a double bond, so each oxygen counts 8. Real O₂ also has two unpaired electrons. That is why liquid oxygen sticks to a magnet.',
    rows: [['Molecule', 'Oxygen, O₂'], ['Shared pairs', '2 (double bond, O=O)'], ['Bond length', '1.208 Å (measured)'], ['Outer shell after sharing', 'O: 8 each']],
  },
  N2: {
    say: 'Each nitrogen has 5 outer electrons. They share three pairs, a triple bond, so each nitrogen counts 8. The triple bond is very strong, which is why nitrogen gas is so unreactive.',
    rows: [['Molecule', 'Nitrogen, N₂'], ['Shared pairs', '3 (triple bond, N≡N)'], ['Bond length', '1.098 Å (measured)'], ['Outer shell after sharing', 'N: 8 each']],
  },
};
function buildCovalent(st) {
  const holder = new THREE.Group();
  st.scene.add(holder);
  const say = document.getElementById('cov-say');
  const read = document.getElementById('cov-read');
  const cache = {};
  let cur = null, wobble = false;
  const atomLabels = [];
  function set(id) {
    if (cur) holder.remove(cur);
    cur = cache[id] ||= buildMolecule(st, id, {
      align: (pos) => {
        if (pos.length === 2) { // lay diatomics left to right
          const d = new THREE.Vector3().subVectors(pos[1], pos[0]).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(d, new THREE.Vector3(1, 0, 0));
          pos.forEach((p) => p.applyQuaternion(q));
        }
      },
    });
    holder.add(cur);
    holder.rotation.set(0, 0, 0);
    wobble = GEOMETRY[id].atoms.length === 2;
    atomLabels.forEach((L) => { L.on = false; });
    GEOMETRY[id].atoms.forEach(([el], i) => {
      const L = atomLabels[i] || (atomLabels[i] = st.label('', 'atom'));
      L.el.textContent = el; L.obj = cur.userData.atomMeshes[i]; L.on = true;
      L.offset.set(0, 0, 0);
    });
    say.textContent = COV[id].say;
    read.innerHTML = COV[id].rows.map(([a, b]) => `<tr><th>${a}</th><td><b>${b}</b></td></tr>`).join('');
    const R = Math.max(2.0, Math.max(...cur.userData.pos.map((p) => p.length())) + 0.9);
    st.fit = { w: R * 1.1, h: R * 1.1 };
    st.refit();
  }
  st.setStep = set;
  st.update = (dt, t) => {
    if (!cur) return;
    if (!reduceMotion) {
      // diatomics sway so they never turn end-on; methane turns all the way round
      if (wobble) holder.rotation.y = Math.sin(t * 0.5) * 0.7;
      else holder.rotation.y += dt * 0.3;
    }
    spinPairs(cur, reduceMotion ? 0 : t);
  };
  set('H2');
}

// ---------- scene 3: polar water ----------
function buildPolar(st) {
  const holder = new THREE.Group();
  st.scene.add(holder);
  // pairs sit nearer the more electronegative atom (drawing choice, see NOTES.md)
  const mol = buildMolecule(st, 'H2O', {
    bias: (ei, ej) => (EN[ei] > EN[ej] ? 0.36 : EN[ei] < EN[ej] ? 0.64 : 0.5),
    align: (pos) => {
      // put O on top and the two H below it, in the screen plane
      const o = pos[0];
      const mid = pos[1].clone().add(pos[2]).multiplyScalar(0.5);
      const down = mid.clone().sub(o).normalize();
      const q1 = new THREE.Quaternion().setFromUnitVectors(down, new THREE.Vector3(0, -1, 0));
      pos.forEach((p) => p.applyQuaternion(q1));
      const hh = pos[2].clone().sub(pos[1]); hh.y = 0; hh.normalize();
      const q2 = new THREE.Quaternion().setFromUnitVectors(hh, new THREE.Vector3(1, 0, 0));
      pos.forEach((p) => p.applyQuaternion(q2));
    },
  });
  holder.add(mol);
  const [mO, mH1, mH2] = mol.userData.atomMeshes;
  const lO = st.label('O', 'atom'); lO.obj = mO;
  const lH1 = st.label('H', 'atom'); lH1.obj = mH1;
  const lH2 = st.label('H', 'atom'); lH2.obj = mH2;
  const dO = st.label('δ−', 'big neg'); dO.obj = mO; dO.offset.set(0, 1.0, 0);
  const dH1 = st.label('δ+', 'big pos'); dH1.obj = mH1; dH1.offset.set(-0.55, -0.75, 0);
  const dH2 = st.label('δ+', 'big pos'); dH2.obj = mH2; dH2.offset.set(0.55, -0.75, 0);
  const eO = st.label('3.44', 'dim'); eO.obj = mO; eO.offset.set(0.95, 0.15, 0);
  const eH1 = st.label('2.20', 'dim'); eH1.obj = mH1; eH1.offset.set(-0.75, 0.25, 0);
  const eH2 = st.label('2.20', 'dim'); eH2.obj = mH2; eH2.offset.set(0.75, 0.25, 0);
  const R = Math.max(...mol.userData.pos.map((p) => p.length())) + 1.1;
  st.fit = { w: R * 1.05, h: R * 1.05 };
  st.refit();
  st.update = (dt, t) => {
    if (!reduceMotion) holder.rotation.y = Math.sin(t * 0.35) * 0.65;
    spinPairs(mol, reduceMotion ? 0 : t);
  };
}

// ---------- boot ----------
const builders = { ionic: buildIonic, covalent: buildCovalent, polar: buildPolar };
for (const el of document.querySelectorAll('.stage[data-scene]')) {
  try {
    const st = makeStage(el);
    builders[el.dataset.scene](st);
    st.resize();
    el._stage = st;
  } catch (err) {
    console.warn(err);
    const p = document.createElement('p');
    p.className = 'caption';
    p.style.padding = '20px';
    p.textContent = 'This browser could not draw the 3D model. The text beside it still covers the lesson.';
    el.appendChild(p);
  }
}
for (const group of document.querySelectorAll('[data-steps]')) {
  const st = document.querySelector(`.stage[data-scene="${group.dataset.steps}"]`)?._stage;
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-step]');
    if (!b || !st) return;
    group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const v = b.dataset.step;
    st.setStep(/^\d+$/.test(v) ? Number(v) : v);
  });
}
const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  for (const st of stages) {
    if (!st.visible) continue;
    st.update && st.update(dt, t);
    st.render();
  }
}
frame();
