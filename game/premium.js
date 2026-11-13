'use strict';
const unlockKey = 'afterburn-demo-airframes-v1';
let unlocked = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(unlockKey) || '[]');
  if (Array.isArray(saved)) unlocked = new Set(saved.filter(id => id === 'nx' || id === 'sf'));
} catch {
  // A private or restricted browser can still use the demo during this session.
}

function isUnlocked(id) {
  return id === 'az' || unlocked.has(id);
}

// The input is original, static art from content.js. Both displays share the same outlines.
function aircraftMarkup(plane, id) {
  const panels = (plane.panels || []).map(panel =>
    `<path d="${panel.shape}" fill="${panel.color}" opacity="${panel.alpha}"/>`).join('');
  return `<svg viewBox="-62 -57 124 114" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0%" y1="0%" x2="70%" y2="100%">
      <stop stop-color="${plane.body}"/><stop offset="100%" stop-color="${plane.shadow}"/>
    </linearGradient></defs>
    <polygon points="${plane.outline}" fill="url(#${id})" stroke="${plane.color}" stroke-width=".9" stroke-linejoin="round"/>
    ${panels}
    <path d="${plane.canopy || 'M0 -32 5 -11 0 0 -5 -11Z'}" fill="#081827" stroke="${plane.color}" stroke-opacity=".6" stroke-width=".65"/>
    <path d="${plane.lights || 'M-5 22 -5 28 M5 22 5 28'}" fill="none" stroke="${plane.color}" stroke-linecap="round" stroke-width="1.35"/>
  </svg>`;
}

function renderPremium() {
  const price = offer => `${offer.demoPrice} ₽ · ориентир`;
  $('premium-cards').innerHTML = offers.filter(offer => offer.id !== 'duo').map(offer => {
    const plane = airframes[offer.id];
    const owned = isUnlocked(offer.id);
    return `<article class="premium-card" style="--accent:${plane.color};--ambient:${plane.color}48;--angle:${offer.id === 'nx' ? -23 : 25}deg">
      <div class="premium-art">${aircraftMarkup(plane,'shop-hull-'+offer.id)}</div>
      <div class="premium-copy">
        <h2>${offer.name}</h2>
        <p>${plane.description}</p><p class="effect-copy">${plane.effect}</p>
        <p class="offer-price">${owned ? 'Открыт для всех маршрутов' : price(offer)}</p>
        <div class="premium-actions">
          <button type="button" class="primary-button" data-try="${offer.id}">Попробовать бесплатно</button>
          <button type="button" class="quiet-button" data-offer="${offer.id}">${owned ? 'Выбрать для вылета' : 'Открыть в тесте'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
  const bundle = offers.find(offer => offer.id === 'duo');
  const remaining = bundle.planes.filter(id => !isUnlocked(id));
  $('premium-bundle').innerHTML = `<div><h2>«${bundle.name}»</h2>
    <p>NX-02 «Графит» и SF-03 «Медь»</p>
    <p>${remaining.length === 2 ? price(bundle) + ' · экономия 99 ₽ за комплект' : remaining.length ? 'Один из самолётов уже открыт. Второй можно открыть отдельно.' : 'Оба самолёта открыты'}</p></div>
    ${remaining.length === 2 ? '<button type="button" class="quiet-button" data-offer="duo">Открыть набор в тесте</button>' : ''}`;
}

function openPremium() {
  renderPremium();
  put('premium-feedback', '');
  showScreen('premium', 'premium-title');
}

function tryAirframe(id) {
  planeId = id;
  sectorId = 'free';
  briefingBack = 'premium';
  openBriefing();
}

function openOffer(id) {
  const offer = offers.find(item => item.id === id);
  if (!offer) return;
  if (id !== 'duo' && isUnlocked(id)) {
    planeId = id;
    sectorId = 'light';
    goHangar();
    return;
  }
  for (const airframe of offer.planes) unlocked.add(airframe);
  let saved = true;
  try { localStorage.setItem(unlockKey, JSON.stringify([...unlocked])); } catch { saved = false; }
  renderPremium();
  put('premium-feedback', (offer.planes.length === 1 ? offer.name + ' открыт' : 'Оба самолёта открыты')
    + ' для всех маршрутов' + (saved ? '.' : ' до закрытия этой страницы.'));
  const focus = $('premium-cards').querySelector('[data-offer="' + offer.planes[0] + '"]');
  focus.focus({preventScroll:true});
}

function onPremiumClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.try) tryAirframe(button.dataset.try);
  if (button.dataset.offer) openOffer(button.dataset.offer);
}
