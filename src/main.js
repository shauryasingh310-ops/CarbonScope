import './style.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Chart, registerables } from 'chart.js';
import { loadAll, flag, fmt, heat, contains, FUELS } from './data.js';
Chart.register(...registerables);
Chart.defaults.color = '#8b93a5'; Chart.defaults.borderColor = '#222c40';

const $ = s => document.querySelector(s);
let countries = [], metric = 'co2', dailyOnly = false, hover = null, selected = null, charts = [], goal = null, range = {};

const el = $('#globe');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); el.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100); camera.position.set(0, 3, 15);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 8, maxDistance: 22, autoRotate: true, autoRotateSpeed: 0.4 });
const canvas = Object.assign(document.createElement('canvas'), { width: 2048, height: 1024 });
const ctx = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
const globe = new THREE.Mesh(new THREE.SphereGeometry(5, 96, 96), new THREE.MeshBasicMaterial({ map: tex }));
scene.add(globe);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(5.35, 64, 64), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 n;void main(){float i=pow(.62-dot(n,vec3(0,0,1)),3.);gl_FragColor=vec4(.35,.5,.9,1.)*i;}' })));
const pts = new Float32Array(4500).map(() => (Math.random() - .5) * 120);
scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), new THREE.PointsMaterial({ size: .08, color: 0x7f8bb0 })));

const px = ([lo, la]) => [(lo + 180) / 360 * 2048, (90 - la) / 180 * 1024];
const val = c => c[metric]?.v ?? null;
function computeRange() {
  const v = countries.map(val).filter(x => x > 0).map(Math.log);
  range = { min: Math.min(...v), max: Math.max(...v) };
  const f = x => fmt(Math.exp(x), metric === 'pc' ? 't' : 'Mt');
  $('#lmin').textContent = f(range.min); $('#lmax').textContent = f(range.max);
}
function paint() {
  ctx.fillStyle = '#0b1120'; ctx.fillRect(0, 0, 2048, 1024);
  const path = c => { ctx.beginPath(); c.polys.forEach(p => p.forEach(r => r.forEach((pt, i) => { const [x, y] = px(pt); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }))); };
  ctx.lineWidth = .8; ctx.strokeStyle = '#090d16';
  for (const c of countries) {
    const v = val(c);
    ctx.fillStyle = v > 0 && !(dailyOnly && !c.daily) ? heat((Math.log(v) - range.min) / (range.max - range.min)) : '#192133';
    path(c); ctx.fill('evenodd'); ctx.stroke();
  }
  for (const c of [hover, selected]) if (c) { path(c); ctx.lineWidth = c === selected ? 3 : 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  tex.needsUpdate = true;
}

const toVec = (lat, lon, r) => { const ph = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); };
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const h = ray.intersectObject(globe)[0]; if (!h) return null;
  const lon = h.uv.x * 360 - 180, lat = h.uv.y * 180 - 90;
  return countries.find(c => contains(c, lon, lat)) || null;
}

let down = null; const tip = $('#tip');
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; controls.autoRotate = false; });
renderer.domElement.addEventListener('pointermove', e => {
  const c = pick(e);
  if (c !== hover) { hover = c; paint(); renderer.domElement.style.cursor = c ? 'pointer' : 'grab'; }
  tip.hidden = !c; if (c) { tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px';
    tip.textContent = `${flag(c.iso2)} ${c.name} · ${c[metric] ? fmt(c[metric].v, metric === 'pc' ? 't' : 'Mt') : 'no data'}`; }
});
renderer.domElement.addEventListener('pointerup', e => {
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const c = pick(e); if (c) select(c); }
  down = null;
});
addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); } });

document.querySelectorAll('#metric button').forEach(b => b.onclick = () => {
  metric = b.dataset.m; document.querySelectorAll('#metric button').forEach(x => x.setAttribute('aria-pressed', x === b));
  computeRange(); paint();
});
$('#daily').onchange = e => { dailyOnly = e.target.checked; paint(); };
const results = $('#results');
$('#q').oninput = e => {
  const q = e.target.value.trim().toLowerCase(); results.innerHTML = '';
  if (!q) return;
  countries.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6).forEach(c => {
    const li = document.createElement('li'); li.tabIndex = 0; li.textContent = `${flag(c.iso2)} ${c.name}`;
    const go = () => { select(c); results.innerHTML = ''; e.target.value = ''; };
    li.onclick = go; li.onkeydown = k => k.key === 'Enter' && go(); results.append(li);
  });
};

const drawer = $('#drawer');
function close() { selected = null; drawer.hidden = true; charts.forEach(c => c.destroy()); charts = []; goal = null; paint(); }
function select(c) {
  selected = c; controls.autoRotate = false; goal = toVec(c.cen[0], c.cen[1], 15).add(new THREE.Vector3(0, 1.5, 0)); paint();
  charts.forEach(x => x.destroy()); charts = [];
  const e = c.em, l = c.co2;
  let story = 'No emissions data is published for this territory.';
  if (e && l) {
    const mix = e.m ? Object.entries(e.m).sort((a, b) => b[1] - a[1]) : [];
    const tot = mix.reduce((s, m) => s + m[1], 0) || 1, now = e.co2[l.year - 1900], then = e.co2[100];
    story = `${c.name} emitted ${fmt(l.v)} of CO₂ in ${l.year}.` +
      (mix.length ? ` ${mix[0][0]} accounts for ${Math.round(mix[0][1] / tot * 100)}% and ${mix[1][0].toLowerCase()} for ${Math.round(mix[1][1] / tot * 100)}%.` : '') +
      (then ? ` That is ${Math.abs(Math.round((now - then) / then * 100))}% ${now >= then ? 'more' : 'less'} than in 2000.` : '');
  }
  drawer.hidden = false;
  drawer.innerHTML = `<button class="x" aria-label="Close">×</button><h2>${flag(c.iso2)} ${c.name}</h2>
    <p class="sub">${c.cont}${c.daily ? ' · tracked daily by Carbon Monitor' : ''}</p>
    <div class="big">${l ? fmt(l.v) : '—'}</div>
    <div class="row"><div><small>Per person</small>${c.pc ? fmt(c.pc.v, 't') : '—'}</div><div><small>Latest year</small>${l ? l.year : '—'}</div></div>
    <p>${story}</p>
    ${e ? `<div class="card"><h3>Emissions since 1900 (Mt CO₂)</h3><canvas id="c1" height="170"></canvas>
      <select id="cmp" aria-label="Compare with another country"><option value="">Compare with…</option>${countries.filter(x => x.em && x !== c).sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.iso}">${x.name}</option>`).join('')}</select></div>
    ${e.m ? `<div class="card"><h3>Where it comes from</h3><canvas id="c2" height="170"></canvas></div>` : ''}` : ''}`;
  drawer.querySelector('.x').onclick = close;
  if (!e) return;
  const years = Array.from({ length: e.co2.length }, (_, i) => 1900 + i);
  const line = (label, d, color) => ({ label, data: d, borderColor: color, borderWidth: 2, pointRadius: 0, tension: .25 });
  const c1 = new Chart($('#c1'), { type: 'line', data: { labels: years, datasets: [line(c.name, e.co2, '#ff8a3d')] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 6 } } }, interaction: { mode: 'index', intersect: false } } });
  charts.push(c1);
  $('#cmp').onchange = ev => {
    c1.data.datasets.length = 1; const o = countries.find(x => x.iso === ev.target.value);
    if (o) c1.data.datasets.push(line(o.name, o.em.co2, '#7fb4ff'));
    c1.options.plugins.legend.display = !!o; c1.update();
  };
  if (e.m) charts.push(new Chart($('#c2'), { type: 'doughnut', data: { labels: FUELS, datasets: [{ data: FUELS.map(f => e.m[f]),
    backgroundColor: ['#3b3f4f', '#c2455a', '#ff8a3d', '#8b93a5', '#ffe29a', '#6a4a8c'], borderWidth: 0 }] },
    options: { cutout: '62%', plugins: { legend: { position: 'right' } } } }));
}

function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
(function loop() {
  requestAnimationFrame(loop);
  if (goal) { camera.position.lerp(goal, .06); if (camera.position.distanceTo(goal) < .05) goal = null; }
  controls.update(); renderer.render(scene, camera);
})();

loadAll().then(c => { countries = c; computeRange(); paint(); $('#status').style.opacity = 0; })
  .catch(err => { $('#status').textContent = 'Could not load data. Run "npm run data" once, then reload.'; console.error(err); });
