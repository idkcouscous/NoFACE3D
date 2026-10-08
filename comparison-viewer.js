import * as THREE from './vendor/three/build/three.module.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/examples/jsm/environments/RoomEnvironment.js';

export function mountComparisonViewer({rootId, dataId, collectionSelector = null, syncURL = false}) {
const root = document.getElementById(rootId);
const element = id => root.querySelector('[data-viewer="' + id + '"]');
const collections = JSON.parse(document.getElementById(dataId).textContent).collections;
const query = new URLSearchParams(location.search);
let collection = syncURL && Object.hasOwn(collections, query.get('collection')) ? query.get('collection') : Object.keys(collections)[0];
let samples = collections[collection].samples;
const qualityButtons = [...root.querySelectorAll('[data-bd-quality]')];
let quality = 'preview';
const collectionButtons = collectionSelector ? [...document.querySelectorAll(collectionSelector)] : [];
const remembered = {};

const picker = root.querySelector('.bd-picker');
const stage = element('bd-stage');
const status = element('bd-status');
const errorBox = element('bd-error');
const overlays = [...root.querySelectorAll('.bd-overlay')];
const input = element('bd-input');
const inputLink = element('bd-input-link');
const boxToggle = root.querySelector('[data-bd-box-toggle]');
let regionHelpers = [], boxesVisible = boxToggle?.checked ?? true;
const actionButtons = [...root.querySelectorAll('[data-bd-action]')];
let selected = Math.max(0, samples.findIndex(s => syncURL && s.id === query.get('sample'))), generation = 0, abort = null, loaded = false, started = false;
let visible = false, dirty = true, lastTime = 0, mode = 'textured', auto = false;
let renderer, camera, controls, scenes, materials, bounds, fullTarget, fullRadius;
let currentGroups = [], detailView = false, lastAspect = null;
const slots = [...root.querySelectorAll('.bd-viewport')];
root.dataset.state = 'waiting';

function announce(message, error = false) {
  status.textContent = message; status.dataset.error = String(error);
}
function setPressed(action, value) {
  root.querySelector('[data-bd-action="' + action + '"]')?.setAttribute('aria-pressed', String(value));
}
function selectionUI() {
  const sample = samples[selected];
  root.dataset.sample = sample.id;
  root.dataset.collection = collection;
  root.dataset.quality = quality;
  qualityButtons.forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.bdQuality === quality));
    b.hidden = b.dataset.bdQuality === 'full' && !sample.sourceModels;
  });

  root.setAttribute('aria-label', collections[collection].label + ' synchronized 3D comparisons');
  root.closest('section').dataset.collection = collection;
  if (element('bd-original-label')) element('bd-original-label').textContent = sample.baselineLabel || 'TRELLIS.2';
  if (element('bd-refined-label')) element('bd-refined-label').textContent = sample.refinedLabel || 'Ours · NOFACE3D';
  root.querySelectorAll('[data-bd-stage-label]').forEach((label, i) => {
    label.textContent = sample.stageLabels[i];
    slots[i].setAttribute('aria-label', sample.stageLabels[i] + ' — drag to rotate all views');
  });
  picker.setAttribute('aria-label', 'Choose a sample: ' + collections[collection].label);
  picker.dataset.size = String(samples.length);
  collectionButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gallery === collection)));

  element('bd-title').textContent = sample.label;
  element('bd-count').textContent = (selected + 1) + ' / ' + samples.length;
  if (input && inputLink) {
    input.src = sample.input; input.alt = 'Conditioning image: ' + sample.label;
    inputLink.href = sample.input;
  }
  picker.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === selected)));
}
function updateLocation() {
  if (!syncURL) return;
  const url = new URL(location.href);
  url.searchParams.set('collection', collection);
  url.searchParams.set('sample', samples[selected].id);
  history.replaceState(null, '', url);
}
function renderPicker() {
  picker.replaceChildren();
  samples.forEach((s, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.sampleIndex = String(i);
    button.setAttribute('aria-label', s.label);
    if (s.thumbnail) {
      const img = document.createElement('img'); img.src = s.thumbnail; img.alt = '';
      button.append(img);
    }
    const label = document.createElement('span'); label.textContent = s.label;
    button.append(label);
    button.addEventListener('click', () => {
      if (i === selected && loaded) return;
      selected = i; remembered[collection] = i;
      selectionUI(); updateLocation();
      if (started) loadSelected();
    });
    picker.appendChild(button);
  });
  selectionUI();
}
function chooseCollection(key) {
  if (key === collection || !Object.hasOwn(collections, key)) return;
  remembered[collection] = selected;
  collection = key; samples = collections[key].samples; selected = remembered[key] || 0;
  renderPicker(); updateLocation();
  if (started) loadSelected();
}
collectionButtons.forEach(button => button.addEventListener('click', () => chooseCollection(button.dataset.gallery)));
renderPicker();

function disposeGroups(groups) {
  const geometries = new Set(), mats = new Set(), textures = new Set(), images = new Set();
  for (const group of groups) {
    group.traverse(obj => {
      if (!obj.isMesh) return;
      geometries.add(obj.geometry);
      const orig = obj.userData.originalMaterial || obj.material;
      for (const mat of Array.isArray(orig) ? orig : [orig]) {
        if (!mat) continue; mats.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
      }
    });
    group.removeFromParent();
  }
  geometries.forEach(x => x.dispose()); mats.forEach(x => x.dispose());
  textures.forEach(t => { if (t.image?.close) images.add(t.image); t.dispose(); });
  images.forEach(x => x.close());
}
function disposeRegionHelpers() {
  for (const helper of regionHelpers) {
    helper.removeFromParent(); helper.geometry.dispose(); helper.material.dispose();
  }
  regionHelpers = [];
}
function refinementBoxes(sample) {
  return sample.refinementBoxes || (sample.refinementBox ? [sample.refinementBox] : []);
}
function addRegionHelpers(sample) {
  const boxes = refinementBoxes(sample);
  root.dataset.regionCount = String(boxes.length);
  // Keep each oriented selection separate; all panes share the same region toggle.
  regionHelpers = boxes.flatMap(box => {
    const coordinates = box.corners || Array.from({length:8}, (_, i) =>
      [box.bounds[(i >> 2) & 1][0], box.bounds[(i >> 1) & 1][1], box.bounds[i & 1][2]]);
    const points = coordinates.map(point => new THREE.Vector3(...point)
      .sub(new THREE.Vector3(...sample.frame.center)).multiplyScalar(sample.frame.scale));
    const edges = [];
    for (let i = 0; i < 8; i++) for (const bit of [1,2,4]) if (!(i & bit)) edges.push(i, i | bit);
    return scenes.map(scene => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.setIndex(edges);
      const helper = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:0xe88126}));
      helper.material.toneMapped = false;
      helper.material.depthTest = false; helper.material.depthWrite = false;
      helper.material.transparent = true; helper.material.opacity = .9;
      helper.renderOrder = 100; helper.visible = boxesVisible;
      scene.add(helper); return helper;
    });
  });
  root.dataset.boxesVisible = String(boxesVisible);
}
boxToggle?.addEventListener('change', () => {
  boxesVisible = boxToggle.checked;
  regionHelpers.forEach(helper => { helper.visible = boxesVisible; });
  root.dataset.boxesVisible = String(boxesVisible); dirty = true;
});
function modeApply() {
  for (const g of currentGroups) g.traverse(obj => {
    if (obj.isMesh) obj.material = mode === 'normals' ? materials.normals : mode === 'clay' ? materials.clay : obj.userData.originalMaterial;
  });
  root.dataset.mode = mode;
  for (const m of ['textured','clay','normals']) setPressed(m, mode === m);
  dirty = true;
}
function frame(detail = false) {
  if (!loaded) return;
  detailView = detail;
  const sample = samples[selected];
  const target = detail ? new THREE.Vector3(...sample.detail.center) : fullTarget.clone();
  const radius = detail ? sample.detail.radius : fullRadius;
  const paneAspect = slots[0].clientWidth / slots[0].clientHeight;
  const halfAngle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1,paneAspect));
  const direction = detail ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(...sample.view).normalize();
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction, radius / Math.sin(halfAngle) * 1.08);
  controls.update(); dirty = true;
  setPressed('full', !detail); setPressed('detail', detail);
}
function resize() {
  if (!renderer || !stage.clientWidth || !stage.clientHeight) return;
  const aspect = slots[0].clientWidth / slots[0].clientHeight;
  if (loaded && lastAspect && Math.abs(lastAspect - aspect) > 0.001) {
    const angle = a => Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, a));
    const factor = Math.sin(angle(lastAspect)) / Math.sin(angle(aspect));
    camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    controls.update();
  }
  lastAspect = aspect;
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  dirty = true;
}
async function readGLB(asset, i, signal, version) {
  let bytes;
  const url = new URL(asset.path, location.href); url.searchParams.set('v',asset.sha256.slice(0,16));
  const response = await fetch(url, {signal, credentials:'same-origin'});
  if (!response.ok) throw new Error('Could not load mesh (HTTP ' + response.status + ').');
  const reader = response.body.getReader(), chunks = [];
  let received = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value); received += value.byteLength;
    if (version === generation) overlays[i].textContent = 'Loading mesh · ' + Math.min(100, Math.round(received / asset.bytes * 100)) + '%';
  }
  if (signal.aborted || version !== generation) throw new DOMException('Cancelled','AbortError');
  if (received !== asset.bytes) throw new Error('Mesh size verification failed.');
  bytes = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  chunks.length = 0;
  if (bytes.byteLength !== asset.bytes) throw new Error('Mesh size verification failed.');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2,'0')).join('');
  if (hex !== asset.sha256) throw new Error('Mesh checksum verification failed.');
  if (signal.aborted || version !== generation) throw new DOMException('Cancelled','AbortError');
  overlays[i].textContent = 'Preparing 3D view…';
  const parsed = await new GLTFLoader().parseAsync(bytes.buffer, '');
  if (signal.aborted || version !== generation) {
    disposeGroups([parsed.scene]); throw new DOMException('Cancelled','AbortError');
  }
  let triangles = 0;
  parsed.scene.traverse(obj => {
    if (!obj.isMesh) return;
    triangles += (obj.geometry.index ? obj.geometry.index.count : obj.geometry.attributes.position.count) / 3;
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.userData.originalMaterial = obj.material;
  });
  if (triangles !== asset.triangles) { disposeGroups([parsed.scene]); throw new Error('Triangle count verification failed.'); }
  return parsed.scene;
}
async function loadSelected(preserveCamera = false) {
  const saved = preserveCamera && loaded ? {position:camera.position.clone(),target:controls.target.clone(),detail:detailView} : null;
  const version = ++generation, sample = samples[selected];
  const focusDetail = Boolean(refinementBoxes(sample).length && detailView);
  const models = quality === 'full' && sample.sourceModels ? sample.sourceModels : sample.models;
  abort?.abort(); abort = new AbortController();
  const signal = abort.signal;
  loaded = false; auto = false;
  controls.autoRotate = false; setPressed('rotate',false);
  element('bd-rotate').textContent = 'Auto-rotate';
  disposeRegionHelpers();
  disposeGroups(currentGroups); currentGroups = [];
  if (boxToggle) boxToggle.disabled = true;
  delete root.dataset.verified;
  root.dataset.state = 'loading'; stage.setAttribute('aria-busy','true');
  errorBox.hidden = true;
  actionButtons.forEach(b => b.disabled = true);
  overlays.forEach(el => { el.hidden = false; el.textContent = 'Loading mesh…'; });
  announce('Loading ' + sample.label + '…');
  const results = await Promise.allSettled(models.map((a,i) => readGLB(a,i,signal,version)));
  const assets = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  if (version !== generation) { disposeGroups(assets); return; }
  const failure = results.find(r => r.status === 'rejected');
  if (failure) {
    disposeGroups(assets); root.dataset.state = 'error'; stage.setAttribute('aria-busy','false');
    overlays.forEach(el => el.textContent = 'View unavailable');
    element('bd-error-message').textContent = failure.reason.message;
    errorBox.hidden = false; announce('Could not load this comparison. Retry below.',true); return;
  }
  bounds = new THREE.Box3();
  currentGroups = assets.map((scene,i) => {
    // Recorded source-to-aligned transform first; both panes then use the same display frame.
    const transform = models[i].transform;
    if (transform) scene.applyMatrix4(new THREE.Matrix4().set(...transform.flat()));
    const group = new THREE.Group(); group.add(scene);
    group.scale.setScalar(sample.frame.scale);
    group.position.set(...sample.frame.center.map(x => -x * sample.frame.scale));
    scenes[i].add(group); group.updateMatrixWorld(true); bounds.union(new THREE.Box3().setFromObject(group));
    return group;
  });
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  fullTarget = sphere.center; fullRadius = sphere.radius;
  addRegionHelpers(sample);
  loaded = true; modeApply(); resize();
  if (saved) {
    camera.position.copy(saved.position); controls.target.copy(saved.target); detailView=saved.detail;
    setPressed('detail',detailView); setPressed('full',!detailView); controls.update();
  } else {
    // Establish the sample orientation before focusing its recorded region.
    frame(false);
    if (focusDetail) frame(true);
  }
  overlays.forEach(el => el.hidden = true);
  actionButtons.forEach(b => b.disabled = false);
  if (boxToggle) boxToggle.disabled = !refinementBoxes(sample).length;
  stage.setAttribute('aria-busy','false'); root.dataset.state = 'ready';
  root.dataset.verified = 'sha256-and-triangles';
  announce('Views synchronized · drag any model to explore');
  dirty = true;
}
function render(time) {
  const delta = Math.min((time-lastTime)/1000 || 0, .1); lastTime = time;
  if (!visible || root.hidden || document.hidden) return;
  const changed = controls.update(delta);
  if (!dirty && !changed && !auto) return;
  dirty = false;
  renderer.setScissorTest(false); renderer.setClearColor(0xf3f4ee,1); renderer.clear();
  renderer.setScissorTest(true);
  const outer = stage.getBoundingClientRect();
  slots.forEach((slot,i) => {
    const rect = slot.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const left = rect.left - outer.left, bottom = outer.bottom - rect.bottom;
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    renderer.setViewport(left,bottom,rect.width,rect.height);
    renderer.setScissor(left,bottom,rect.width,rect.height);
    renderer.render(scenes[i],camera);
  });
}
function start() {
  if (started) return;
  started = true;
  try {
    renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute('aria-hidden','true'); stage.prepend(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); root.dataset.state='error';
      element('bd-error-message').textContent='The graphics context was lost. Reload the page to restore the viewer.';
      errorBox.hidden=false; announce('3D viewer paused.',true);
    });
    camera = new THREE.PerspectiveCamera(35,1,.005,100);
    controls = new OrbitControls(camera,stage);
    controls.enableDamping = true; controls.dampingFactor = .12;
    controls.minDistance=.08; controls.maxDistance=30; controls.autoRotateSpeed=1.5;
    controls.minPolarAngle=.01; controls.maxPolarAngle=Math.PI-.01;
    controls.addEventListener('change',() => { dirty=true; });
    // Wheel keeps the document scrollable; Alt+wheel zooms the shared camera.
    controls.enableZoom = false;
    stage.addEventListener('wheel',e => {
      if (!e.altKey || !loaded) return;
      e.preventDefault();
      const factor=Math.exp(Math.sign(e.deltaY)*.09);
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      controls.update(); dirty=true;
    },{passive:false});
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room,.04).texture; room.dispose(); pmrem.dispose();
    scenes = slots.map(() => {
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf3f4ee);
      scene.environment = environment; scene.environmentIntensity=.85;
      scene.add(new THREE.HemisphereLight(0xffffff,0x7b826d,1.5));
      const key = new THREE.DirectionalLight(0xffffff,2.2); key.position.set(3,5,5); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff,.6); fill.position.set(-4,1,-2); scene.add(fill);
      return scene;
    });
    materials = {normals:new THREE.MeshNormalMaterial({side:THREE.DoubleSide}),clay:new THREE.MeshStandardMaterial({color:0xb8bbae,roughness:.8,metalness:0,side:THREE.DoubleSide})};
    new ResizeObserver(resize).observe(stage);
    controls.addEventListener('start',()=>{ stage.classList.add('dragging'); });
    controls.addEventListener('end',()=>{ stage.classList.remove('dragging'); });
    resize(); renderer.setAnimationLoop(render); loadSelected();
  } catch (error) {
    root.dataset.state='error'; element('bd-error-message').textContent='This browser could not start WebGL. '+error.message;
    errorBox.hidden=false; announce('3D viewer unavailable.',true);
  }
}
actionButtons.forEach(button => button.addEventListener('click',() => {
  const action = button.dataset.bdAction;
  if (['textured','clay','normals'].includes(action)) { mode=action; modeApply(); return; }
  if (action === 'full') frame(false);
  if (action === 'detail') frame(true);
  if (action === 'rotate') {
    auto=!auto; controls.autoRotate=auto; setPressed('rotate',auto);
    button.textContent=auto?'Pause rotation':'Auto-rotate'; dirty=true;
  }
  if (action === 'zoom-in' || action === 'zoom-out') {
    const offset=camera.position.clone().sub(controls.target);
    const distance=THREE.MathUtils.clamp(offset.length()*(action==='zoom-in'?.8:1.25),controls.minDistance,controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(distance));controls.update();dirty=true;
  }
}));
qualityButtons.forEach(button => button.addEventListener('click', () => {
  if (quality === button.dataset.bdQuality) return;
  quality = button.dataset.bdQuality;
  selectionUI();
  element('bd-quality-note').textContent = quality === 'full'
    ? 'Full-quality source meshes.'
    : 'Simplified previews. Use Full quality to inspect the original geometry and textures.';
  if (started) loadSelected(true);
}));
element('bd-retry').addEventListener('click',()=> {
  if(renderer && controls) loadSelected(); else location.reload();
});
new IntersectionObserver(entries => {
  visible=entries[0].isIntersecting;
  if (visible) { start(); resize(); dirty=true; }
},{rootMargin:'180px'}).observe(root);
document.addEventListener('visibilitychange',()=>{dirty=true;});

}
