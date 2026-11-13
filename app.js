const REPO = 'Vladimir761867/Afterburn-Skies';
const $ = (selector) => document.querySelector(selector);
const getJSON = async (path) => { const response = await fetch(path); if (!response.ok) throw new Error(path); return response.json(); };

function renderMetrics(data, planes) {
  const done = data.roadmap.filter(item => item.status === 'done').length;
  const progress = Math.round(done / data.roadmap.length * 100);
  $('#metrics').innerHTML = [
    ['Готовность прототипа', `${progress}%`, 'по текущему roadmap'],
    ['Макеты', data.stats.mockups, 'экрана в первой версии'],
    ['Самолёты', planes.length, 'в стартовом ангаре'],
    ['Последняя версия', data.stats.version, data.stats.release]
  ].map(([label,value,meta]) => `<article class="metric"><div class="label">${label}</div><div class="value">${value}</div><div class="meta">${meta}</div></article>`).join('');
  $('#progress-label').textContent = `${progress}%`;
  $('#progress-bar').style.width = `${progress}%`;
}

function renderUpdates(updates) {
  $('#update-count').textContent = updates.length;
  $('#updates').innerHTML = updates.slice(0,4).map(item => `<div class="update"><div class="update-date">${item.date}</div><div><strong>${item.title}</strong><span>${item.description}</span></div></div>`).join('');
}

function renderRoadmap(items) {
  $('#roadmap').innerHTML = items.map(item => `<div class="roadmap-row ${item.status}"><i></i><span>${item.title}</span><b>${item.status === 'done' ? 'готово' : item.status === 'current' ? 'сейчас' : 'дальше'}</b></div>`).join('');
}

function renderPlanes(planes) {
  $('#planes').innerHTML = planes.map(plane => `<article class="plane-card"><div class="plane-visual" style="--plane-bg:${plane.background};--plane-color:${plane.color}"><div class="mini-plane"></div></div><div class="plane-info"><div class="plane-top"><div><div class="plane-name">${plane.name}</div><div class="plane-type">${plane.role}</div></div><div class="plane-price">${plane.price}</div></div><p>${plane.description}</p></div></article>`).join('');
}

function showNotification(items, source) {
  const newest = items[0];
  const seen = localStorage.getItem('afterburn-last-seen') || '';
  if (!newest || newest.id === seen) return;
  $('#new').classList.remove('hidden');
  $('#notice-title').textContent = source === 'github' ? 'В GitHub появились изменения' : 'Появились новые материалы';
  $('#notice-copy').textContent = newest.title || newest.message || 'Проверьте список изменений проекта.';
  $('#mark-seen').onclick = () => { localStorage.setItem('afterburn-last-seen', newest.id); $('#new').classList.add('hidden'); };
}

async function checkGitHub() {
  const status = $('#api-status');
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=5`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error('API');
    const commits = await response.json();
    const updates = commits.map(commit => ({ id: commit.sha, title: commit.commit.message.split('\n')[0], description: `изменение от ${new Date(commit.commit.author.date).toLocaleDateString('ru-RU')}`, date: new Date(commit.commit.author.date).toLocaleDateString('ru-RU') }));
    status.textContent = 'GitHub sync: подключён';
    showNotification(updates, 'github');
  } catch (error) { status.textContent = 'GitHub sync: локальные данные'; }
}

(async function init() {
  try {
    const [data, planes, updates] = await Promise.all([getJSON('data/roadmap.json'), getJSON('data/planes.json'), getJSON('data/updates.json')]);
    renderMetrics(data, planes); renderUpdates(updates); renderRoadmap(data.roadmap); renderPlanes(planes);
    $('#last-updated').textContent = `обновлено ${data.updated}`;
    showNotification(updates, 'local');
  } catch (error) { $('#last-updated').textContent = 'данные временно недоступны'; }
  checkGitHub();
})();
