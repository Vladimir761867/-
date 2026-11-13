'use strict';
const $ = id => document.getElementById(id);
const canvas = $('flight-canvas'), ctx = canvas.getContext('2d');
const screenIds = ['hangar', 'briefing', 'flight', 'result'];
const keys = new Set();
const storageKey = 'afterburn-sector-records-v1';
let records = {}, canSave = true, sound = false, audio;
try { records = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { records = {}; }
if (typeof records !== 'object' || Array.isArray(records)) records = {};
let planeId = 'az', sectorId = 'light', screen = 'hangar', run, frame, last, messageUntil = 0;
let width = 1, height = 1, pointer = null, firePointer = false;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const nfmt = new Intl.NumberFormat('ru-RU');
const put = (id, value) => { const node = $(id); value = String(value); if (node.textContent !== value) node.textContent = value; };
const sector = () => sectors[sectorId];
const isFree = () => sectorId === 'free';
const flightPlane = () => airframes[isFree() ? planeId : 'az'];
const isFlying = () => screen === 'flight' && run && !run.paused;

function showScreen(next, focus) {
  screen = next;
  for (const id of screenIds) $(id + '-screen').hidden = next !== id;
  document.body.classList.toggle('in-flight', next === 'flight');
  if (next !== 'flight') cancelAnimationFrame(frame);
  window.scrollTo(0, 0);
  if (focus) $(focus).focus({preventScroll:true});
}

function makeChoices() {
  for (const [id, plane] of Object.entries(airframes)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plane-choice';
    button.innerHTML = '<span class="choice-swatch"></span><span><b></b><small></small></span><em></em>';
    button.firstElementChild.style.background = plane.body;
    button.firstElementChild.style.color = plane.color;
    button.querySelector('b').textContent = plane.name;
    button.querySelector('small').textContent = plane.role;
    button.dataset.id = id;
    button.onclick = () => { planeId = id; if (id !== 'az') sectorId = 'free'; renderHangar(); };
    $('plane-picker').append(button);
  }
  for (const [id, item] of Object.entries(sectors)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sector-choice';
    button.innerHTML = '<span></span><span><b></b><small></small></span><span class="sector-record"></span>';
    button.firstElementChild.textContent = item.number;
    button.querySelector('b').textContent = item.title;
    button.querySelector('small').textContent = item.label;
    button.dataset.id = id;
    button.onclick = () => { sectorId = id; renderHangar(); };
    $('sector-picker').append(button);
  }
}

function best(id) { return Number.isSafeInteger(records[id]) && records[id] > 0 ? records[id] : 0; }
function renderHangar() {
  const plane = airframes[planeId];
  put('stage-role', plane.role.toUpperCase());
  put('stage-name', plane.name);
  put('plane-description', plane.description);
  $('airframe-art').style.setProperty('--airframe-glow', plane.color);
  $('hull-outline').setAttribute('points', plane.outline);
  $('hull-outline').setAttribute('stroke', plane.color);
  $('hull-bright').setAttribute('stop-color', plane.body);
  $('hull-dark').setAttribute('stop-color', plane.shadow);
  for (const button of $('plane-picker').children) {
    const selected = button.dataset.id === planeId;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected);
    button.querySelector('em').textContent = selected ? 'выбран' : '';
  }
  for (const button of $('sector-picker').children) {
    const id = button.dataset.id, selected = id === sectorId;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected);
    button.querySelector('.sector-record').textContent = id === 'free' || !best(id) ? '' : '✦ ' + nfmt.format(best(id));
  }
  put('selection-hint', !isFree() && planeId !== 'az' ? 'Зачётный вылет на AZ-01. Выбранный самолёт доступен в свободном небе.' : '');
}

function openBriefing() {
  const s = sector();
  put('briefing-label', 'СЕКТОР ' + s.number + ' / ' + s.label.toUpperCase());
  put('briefing-title', s.title);
  put('briefing-description', s.description);
  put('briefing-plane', flightPlane().name);
  put('briefing-controls', s.controls);
  put('briefing-time', s.duration ? s.duration + ' сек' : '∞');
  $('briefing-bonuses').hidden = isFree();
  showScreen('briefing', 'briefing-title');
}

function resize() {
  const box = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, box.width);
  height = Math.max(1, box.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (screen === 'flight' && run) render();
}

function start() {
  cancelAnimationFrame(frame);
  keys.clear();
  pointer = null;
  firePointer = false;
  run = {t:0, event:0, nextFree:2, freeIndex:0, x:.5, y:.71, tx:.5, ty:.71, bank:0,
    energy:100, score:0, targets:0, rings:0, tricks:0, bonuses:0, combo:1, chainEnd:0,
    missiles:3, shotAt:0, trickAt:0, rollEnd:0, safeUntil:0, objects:[], shots:[], sparks:[], paused:false};
  messageUntil = 0;
  $('pause-overlay').hidden = true;
  $('trick-button').disabled = false;
  const battle = sector().targets > 0;
  for (const id of ['target-hud','fire-button','missile-button']) $(id).hidden = !battle;
  for (const id of ['time-hud','energy-hud']) $(id).hidden = isFree();
  $('end-free').hidden = !isFree();
  put('flight-sector', 'СЕКТОР ' + sector().number);
  put('flight-title', sector().title);
  showScreen('flight', 'flight-canvas');
  resize();
  showMessage('Веди самолёт', battle ? 'Огонь включается при движении пальцем' : 'Наведи самолёт на кольцо', 2.6);
  hud();
  last = performance.now();
  frame = requestAnimationFrame(loop);
}

function spawn(type, x) {
  const moving = type === 'enemy' || type === 'ace';
  run.objects.push({type, x, y:-.075, baseX:x, age:0, speed:moving ? .29 : .245,
    hp:type === 'ace' ? 2 : 1, dead:false, checked:false});
}

function showMessage(title, detail, duration = 1.2) {
  putMessage('span', title);
  putMessage('small', detail);
  $('flight-message').classList.remove('hidden');
  messageUntil = run.t + duration;
}
function putMessage(tag, text) { $('flight-message').querySelector(tag).textContent = text; }
function combo(points) {
  run.score += points * run.combo;
  run.combo = Math.min(5, run.combo + 1);
  run.chainEnd = Math.max(run.chainEnd, run.t + 4);
}
function spark(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4, speed = .03 + Math.random() * .14;
    run.sparks.push({x,y,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed,life:.3+Math.random()*.34,color});
  }
}
function collect(o) {
  o.dead = true;
  run.bonuses++;
  if (o.type === 'repair') {
    const before = run.energy;
    run.energy = Math.min(100, before + 30);
    showMessage('Ремонт', before < 100 ? '+' + (run.energy - before) + ' энергии' : 'Энергия полная');
  } else {
    run.combo = Math.max(2, run.combo);
    run.chainEnd = Math.max(run.t, run.chainEnd) + 8;
    showMessage('Заряд серии', '+8 секунд к серии');
  }
  spark(o.x, o.y, '#a5ffcd');
  tone('bonus');
}
function hurt(amount) {
  if (isFree() || run.safeUntil > run.t) return;
  run.energy = Math.max(0, run.energy - amount);
  run.combo = 1;
  run.chainEnd = 0;
  run.safeUntil = run.t + .75;
  spark(run.x, run.y, '#ff886d');
  showMessage('Столкновение', '−' + amount + ' энергии');
  tone('hit');
}
function trick() {
  if (!isFlying() || run.t < run.trickAt) return;
  run.tricks++;
  run.trickAt = run.t + 2;
  run.rollEnd = run.t + .48;
  // Tricks keep a live chain going, but cannot farm a ranked score on their own.
  if (run.chainEnd > run.t) run.chainEnd = Math.max(run.chainEnd, run.t + 2.5);
  spark(run.x, run.y, flightPlane().color, 10);
  showMessage('Бочка', 'Манёвр выполнен');
  tone('trick');
}
function target() {
  let nearest, distance = Infinity;
  for (const o of run.objects) {
    if (o.dead || (o.type !== 'enemy' && o.type !== 'ace') || o.y < .02 || o.y > run.y + .025) continue;
    const d = Math.hypot(o.x - run.x, o.y - run.y);
    if (d < distance) { nearest = o; distance = d; }
  }
  return nearest;
}
function shoot() {
  const aim = target();
  run.shots.push({x:run.x,y:run.y-.037,aim,life:.65});
  run.shotAt = run.t + .24;
}
function damage(o, amount) {
  if (o.dead) return;
  o.hp -= amount;
  spark(o.x,o.y,'#ffb278',o.hp > 0 ? 6 : 19);
  if (o.hp > 0) return;
  o.dead = true;
  run.targets++;
  combo(o.type === 'ace' ? 220 : 120);
  showMessage(o.type === 'ace' ? 'Лидер сбит' : 'Цель сбита', 'Серия ×' + run.combo);
  tone('hit');
}
function missile() {
  if (!isFlying() || !sector().targets || !run.missiles) return;
  const o = target();
  if (!o) { showMessage('Нет цели', 'Дождись появления метки'); return; }
  run.missiles--;
  damage(o, 2);
  hud();
}
function move(dt) {
  const right = +keys.has('ArrowRight') - +keys.has('ArrowLeft');
  const down = +keys.has('ArrowDown') - +keys.has('ArrowUp');
  run.tx = clamp(run.tx + right * dt * .85, .07, .93);
  run.ty = clamp(run.ty + down * dt * .65, .42, .78);
  run.bank += (clamp((run.tx-run.x)*4,-.42,.42)-run.bank)*Math.min(1, dt*9);
  run.x += (run.tx-run.x)*Math.min(1,dt*10);
  run.y += (run.ty-run.y)*Math.min(1,dt*10);
}

function step(dt) {
  run.t += dt;
  const s = sector();
  if (run.t >= run.chainEnd) run.combo = 1;
  move(dt);
  while (s.events[run.event]?.[0] <= run.t) {
    const [,type,x] = s.events[run.event++];
    spawn(type,x);
  }
  if (isFree() && run.t >= run.nextFree) {
    spawn('ring',[.5,.32,.68,.43,.6][run.freeIndex++ % 5]);
    run.nextFree += 4.5;
  }
  if (s.targets && run.t >= run.shotAt && (firePointer || keys.has(' ') || pointer?.touch)) shoot();
  for (const o of run.objects) {
    if (o.dead) continue;
    o.age += dt;
    o.y += o.speed * dt;
    if (o.y > 1.14) { o.dead = true; continue; }
    const dx = Math.abs(o.x - run.x);
    const dy = Math.abs(o.y - run.y);
    if (o.type === 'enemy' || o.type === 'ace') {
      o.x = o.baseX + Math.sin(o.age * (o.type === 'ace' ? 2.6 : 1.8)) * .052;
      if (dx < .08 && dy < .044) { hurt(24); o.dead = true; }
    } else if (o.type === 'repair' || o.type === 'series') {
      if (dx < Math.max(23 / width, .04) && dy < .055) collect(o);
    } else if (!o.checked && o.y >= run.y) {
      o.checked = true;
      const gate = o.type === 'gate';
      if (dx <= (gate ? .112 : .15)) {
        run.rings++;
        combo(gate ? 220 : 160);
        showMessage(gate ? 'Чистый пролёт' : 'Кольцо пройдено', 'Серия ×' + run.combo);
        spark(o.x, o.y, '#ffd082');
        tone('ring');
      } else {
        run.combo = 1;
        run.chainEnd = 0;
        if (gate) hurt(28);
        else if (!isFree()) showMessage('Кольцо пропущено', 'Следующее уже на маршруте');
      }
    }
  }
  for (const shot of run.shots) {
    shot.life -= dt;
    if (shot.aim && !shot.aim.dead) {
      const dx = shot.aim.x-shot.x, dy = shot.aim.y-shot.y, d = Math.hypot(dx,dy);
      if (d < .035 + dt*1.9) { damage(shot.aim, 1); shot.life = 0; }
      else { shot.x += dx/d*1.9*dt; shot.y += dy/d*1.9*dt; }
    } else shot.y -= dt*1.9;
  }
  run.objects = run.objects.filter(o => !o.dead);
  run.shots = run.shots.filter(shot => shot.life > 0 && shot.y > -.1);
  for (const p of run.sparks) { p.x+=p.dx*dt; p.y+=p.dy*dt; p.life-=dt; }
  run.sparks = run.sparks.filter(p => p.life > 0);
  if (run.t >= messageUntil) $('flight-message').classList.add('hidden');
  hud();
  if (!isFree()) {
    if (!run.energy) finish('energy');
    else if (run.targets >= s.targets && run.rings >= s.rings) finish('success');
    else if (run.t >= s.duration) finish('timeout');
  }
}

function hud() {
  const s = sector();
  put('score-value', nfmt.format(run.score));
  put('target-value', Math.min(run.targets, s.targets) + '/' + s.targets);
  put('ring-value', s.rings ? Math.min(run.rings, s.rings) + '/' + s.rings : run.rings);
  put('time-value', Math.max(0, Math.ceil(s.duration - run.t)) + ' с');
  put('energy-value', run.energy + '%');
  put('combo-value', '×' + run.combo);
  put('missile-count', run.missiles);
  $('missile-button').disabled = run.missiles === 0;
  $('trick-button').disabled = run.t < run.trickAt;
}

function finish(reason) {
  if (screen !== 'flight' || isFree()) return;
  const success = reason === 'success', s = sector();
  if (success) run.score += run.energy * 2 + 250;
  const personalBest = success && run.score > best(sectorId);
  if (personalBest) {
    records[sectorId] = run.score;
    try { localStorage.setItem(storageKey, JSON.stringify(records)); } catch {
      canSave = false;
      put('save-status', 'Хранилище браузера недоступно');
    }
  }
  put('result-sector', s.title.toUpperCase());
  put('result-title', success ? 'Маршрут пройден' : 'Вылет не завершён');
  put('result-copy', success ? 'Все задачи выполнены.' : reason === 'energy' ? 'Энергия закончилась.' : 'Время вышло. Выполни все задачи до конца отсчёта.');
  put('result-score', nfmt.format(run.score));
  put('result-record', personalBest ? (canSave ? 'НОВЫЙ РЕКОРД' : 'НОВЫЙ РЕКОРД В ЭТОЙ СЕССИИ') : best(sectorId) ? 'РЕКОРД: ' + nfmt.format(best(sectorId)) : 'РЕКОРД ОТКРОЕТСЯ ПОСЛЕ УСПЕШНОГО ВЫЛЕТА');
  $('result-target-row').hidden = !s.targets;
  put('result-targets', run.targets + ' / ' + s.targets);
  put('result-rings', run.rings + ' / ' + s.rings);
  put('result-tricks', run.tricks);
  put('result-bonuses', run.bonuses);
  showScreen('result', 'result-title');
}

function goHangar() {
  keys.clear();
  pointer = null;
  firePointer = false;
  renderHangar();
  showScreen('hangar', 'fly-button');
}

function loop(now) {
  if (!isFlying()) return;
  step(Math.min(.05, (now-last)/1000));
  last = now;
  if (isFlying()) { render(); frame = requestAnimationFrame(loop); }
}
function pause() {
  if (screen !== 'flight') return;
  run.paused = !run.paused;
  $('pause-overlay').hidden = !run.paused;
  if (run.paused) {
    cancelAnimationFrame(frame);
    keys.clear(); pointer = null; firePointer = false;
    $('resume-button').focus();
  } else {
    $('flight-canvas').focus({preventScroll:true});
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
}
function tone(type) {
  if (!sound || !audio || audio.state !== 'running') return;
  const o = audio.createOscillator(), g = audio.createGain(), now = audio.currentTime;
  const plane = flightPlane();
  o.type = type === 'trick' ? plane.wave : 'sine';
  const base = type === 'trick' ? plane.tone : {ring:460,bonus:340,hit:120}[type];
  o.frequency.setValueAtTime(base,now);
  o.frequency.exponentialRampToValueAtTime(base * (type === 'hit' ? .52 : 2),now+.14);
  g.gain.setValueAtTime(.075,now);
  g.gain.exponentialRampToValueAtTime(.001,now+.18);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(now+.19);
}
async function toggleSound() {
  if (!sound) {
    try { audio ??= new AudioContext(); await audio.resume(); } catch {
      put('sound-button','Звук недоступен');
      return;
    }
  }
  sound = !sound;
  put('sound-button', sound ? 'Звук: вкл.' : 'Звук: выкл.');
  $('sound-button').setAttribute('aria-pressed', sound);
}

function point(e) {
  const box = canvas.getBoundingClientRect();
  run.tx = clamp((e.clientX-box.left)/width,.07,.93);
  run.ty = clamp((e.clientY-box.top)/height,.42,.78);
}
canvas.addEventListener('pointerdown',e=>{
  if (!isFlying() || pointer) return;
  pointer={id:e.pointerId,startY:e.clientY,startX:e.clientX,at:performance.now(),touch:e.pointerType==='touch',tricked:false};
  canvas.setPointerCapture(e.pointerId);
  point(e);
});
canvas.addEventListener('pointermove',e=>{
  if (!isFlying() || pointer?.id !== e.pointerId) return;
  point(e);
  if (pointer.touch && !pointer.tricked && pointer.startY-e.clientY > 65 && Math.abs(pointer.startX-e.clientX)<40 && performance.now()-pointer.at<350) {
    pointer.tricked=true; trick();
  }
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,e=>{ if(pointer?.id===e.pointerId)pointer=null; });
$('fire-button').addEventListener('pointerdown',e=>{
  if(!isFlying())return;
  e.preventDefault();
  $('fire-button').setPointerCapture(e.pointerId);
  firePointer = true;
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) $('fire-button').addEventListener(event,()=>{ firePointer=false; });
$('fire-button').addEventListener('click',e=>{ if(!e.detail && isFlying())shoot(); });
window.addEventListener('keydown',e=>{
  if (screen !== 'flight') return;
  if (e.key === 'Escape' && !e.repeat) { e.preventDefault(); pause(); return; }
  if (!isFlying()) return;
  if (e.key.startsWith('Arrow') || (e.key === ' ' && e.target.tagName !== 'BUTTON')) {
    e.preventDefault(); keys.add(e.key);
  }
  if (!e.repeat && e.code === 'KeyE') trick();
  if (!e.repeat && e.code === 'KeyR') missile();
});
window.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('resize',()=>{ if (screen === 'flight') resize(); });
document.addEventListener('visibilitychange',()=>{ if (document.hidden && isFlying()) pause(); });
$('fly-button').onclick = openBriefing;
$('start-mission').onclick = $('retry-button').onclick = start;
$('back-hangar').onclick = $('quit-button').onclick = $('end-free').onclick = $('result-hangar').onclick = goHangar;
$('pause-button').onclick = $('resume-button').onclick = pause;
$('trick-button').onclick = trick;
$('missile-button').onclick = missile;
$('sound-button').onclick = toggleSound;
makeChoices();
renderHangar();
