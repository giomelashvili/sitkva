import {
  SEED_WORDS, SEED_CHARACTERS, DEFAULT_SETTINGS, DEFAULT_PLAN, QUESTIONS, makeRng, planSession, initialTrialState, trialReducer,
  shouldPauseForRealObject, shouldReward, chooseCharacterCards, aggregate, wordTrend, suggestions, nextSession, planIsValid,
  toICS, toCSV, masteryOf, pickQuestions, ageText, gateStatus, dayKey, usableWords, suggestionKey
} from './logic.js';
import { createChiku } from './chiku.js';

// ---------------------------------------------------------------- storage
const KEY = 'sitkva.v1';
const TEST = new URLSearchParams(location.search).get('test') === '1';
const store = loadStore();
function loadStore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s) s = { profile: null, settings: { ...DEFAULT_SETTINGS }, words: SEED_WORDS.map(w => ({ ...w, enabled: true, level: 0, photos: [] })), characters: SEED_CHARACTERS.map(c => ({ ...c, enabled: true, hidden: false, clips: [] })), plan: { ...DEFAULT_PLAN }, log: [], rotation: 0 };
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  if (TEST) Object.assign(s.settings, { choiceWaitMs: 400, vocalWaitMs: 400, feedbackMs: 250, requirePhotos: false });
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { toast('შენახვა ვერ მოხერხდა: ' + e.message); } }

const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('sitkva-media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async put(key, blob) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(key) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction('blobs').objectStore('blobs').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); },
  async del(key) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').delete(key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
};
const urlCache = new Map();
async function blobURL(key) {
  if (!key) return null;
  if (urlCache.has(key)) return urlCache.get(key);
  try { const b = await idb.get(key); if (!b) return null; const u = URL.createObjectURL(b); urlCache.set(key, u); return u; } catch (e) { return null; }
}

// ---------------------------------------------------------------- helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const now = () => Date.now();
const wait = ms => new Promise(r => setTimeout(r, ms));
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); state.screen = id; }
const wordById = id => store.words.find(w => w.id === id);
const charById = id => store.characters.find(c => c.id === id);
const fmtMin = ms => `${Math.floor(ms / 60000)} წთ ${Math.round((ms % 60000) / 1000)} წმ`;
const checkSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const starSVG = '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="#fff"/></svg>';

// placeholder picture when no photo is uploaded yet
const ICONS = {
  tsqali: '<path d="M30 12h60l-8 96q-1 6-7 6H45q-6 0-7-6z" fill="#fff" stroke="#9CCFE0" stroke-width="4"/><path d="M36 52h48l-4 56q0 4-4 4H44q-4 0-4-4z" fill="#7FC8E8"/>',
  gakhseni: '<rect x="16" y="50" width="88" height="62" rx="10" fill="#E9B97A"/><rect x="8" y="34" width="104" height="24" rx="8" fill="#D99A55"/><rect x="52" y="34" width="16" height="78" fill="#F29E7E" opacity=".85"/>',
  burti: '<circle cx="60" cy="60" r="44" fill="#F2A65A"/><path d="M20 50q40-20 80 0M20 72q40 20 80 0" fill="none" stroke="#fff" stroke-width="6"/>',
  manqana: '<rect x="10" y="56" width="100" height="34" rx="10" fill="#4FB3C8"/><path d="M30 56l14-22h32l14 22z" fill="#8CD0DF"/><circle cx="36" cy="92" r="11" fill="#1F3A44"/><circle cx="84" cy="92" r="11" fill="#1F3A44"/>',
  tsigni: '<path d="M18 24h38q4 0 4 4v70q-4-4-8-4H18z" fill="#F7C7AE"/><path d="M102 24H64q-4 0-4 4v70q4-4 8-4h34z" fill="#D3C8EE"/>',
  dzaghli: '<ellipse cx="60" cy="66" rx="34" ry="30" fill="#D9A066"/><ellipse cx="30" cy="54" rx="10" ry="20" fill="#B47A3E"/><ellipse cx="90" cy="54" rx="10" ry="20" fill="#B47A3E"/><circle cx="48" cy="60" r="4" fill="#1F3A44"/><circle cx="72" cy="60" r="4" fill="#1F3A44"/><ellipse cx="60" cy="76" rx="7" ry="5" fill="#1F3A44"/>',
  kata: '<circle cx="60" cy="68" r="32" fill="#B9B9B9"/><path d="M34 46l-4-24 20 14zM86 46l4-24-20 14z" fill="#B9B9B9"/><circle cx="48" cy="64" r="4" fill="#1F3A44"/><circle cx="72" cy="64" r="4" fill="#1F3A44"/><path d="M60 72l-4 5h8z" fill="#F4A3A0"/>',
  pekhsatsmeli: '<path d="M14 84q0-12 12-12h18l16-20h12l6 20h20q10 0 10 10v8H14z" fill="#2E8FA3"/><rect x="14" y="88" width="94" height="10" rx="4" fill="#1F3A44"/>',
  tvali: '<path d="M10 60q50-50 100 0-50 50-100 0z" fill="#fff" stroke="#1F3A44" stroke-width="4"/><circle cx="60" cy="60" r="18" fill="#4FB3C8"/><circle cx="60" cy="60" r="8" fill="#1F3A44"/>',
  puri: '<rect x="14" y="40" width="92" height="50" rx="22" fill="#E3A55A"/><path d="M30 48q30-12 60 0" fill="none" stroke="#F6C27A" stroke-width="8" stroke-linecap="round"/>',
  abano: '<rect x="10" y="60" width="100" height="40" rx="18" fill="#9ED8E4"/><path d="M20 60V30q0-10 10-10h8" fill="none" stroke="#B9B9B9" stroke-width="6"/><circle cx="40" cy="48" r="5" fill="#fff"/><circle cx="60" cy="42" r="7" fill="#fff"/><circle cx="82" cy="50" r="4" fill="#fff"/>',
  nana: '<rect x="12" y="56" width="96" height="36" rx="10" fill="#D3C8EE"/><rect x="18" y="38" width="36" height="22" rx="8" fill="#fff"/><path d="M62 24l6 6-6 6M78 14l6 6-6 6" fill="none" stroke="#2E8FA3" stroke-width="4" stroke-linecap="round"/>',
  mome: '<path d="M40 100V60q0-10 10-10t10 10v10M60 70V46q0-10 10-10t10 10v24M80 70V54q0-10 10-10t10 10v30q0 20-20 20H58q-16 0-24-14l-8-14q-4-8 4-12t12 4l8 12" fill="#F7C7AE" stroke="#E3A55A" stroke-width="3"/>',
  zevit: '<path d="M60 100V30M30 60l30-30 30 30" fill="none" stroke="#3E9A62" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
  kidev: '<path d="M60 24v72M24 60h72" stroke="#2E8FA3" stroke-width="14" stroke-linecap="round"/>',
  morcha: '<path d="M24 62l24 24 48-52" fill="none" stroke="#3E9A62" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>',
  ara: '<path d="M30 30l60 60M90 30L30 90" stroke="#C97A1E" stroke-width="14" stroke-linecap="round"/>',
  vai: '<path d="M60 20v52" stroke="#C97A1E" stroke-width="16" stroke-linecap="round"/><circle cx="60" cy="96" r="10" fill="#C97A1E"/>',
  amam: '<ellipse cx="46" cy="40" rx="20" ry="26" fill="#B9B9B9"/><path d="M46 64l18 44" stroke="#B9B9B9" stroke-width="10" stroke-linecap="round"/>',
  tskheli: '<circle cx="60" cy="64" r="22" fill="#F6C27A"/><g stroke="#C97A1E" stroke-width="6" stroke-linecap="round"><path d="M60 14v14M60 100v14M14 64h14M92 64h14M26 30l10 10M84 88l10 10M26 98l10-10M84 40l10-10"/></g>',
  didi: '<circle cx="60" cy="60" r="46" fill="#4FB3C8"/>',
  patara: '<circle cx="60" cy="60" r="14" fill="#4FB3C8"/>',
  bai: '<path d="M44 104V62q0-10 10-10t10 10v8M64 70V40q0-10 10-10t10 10v30M84 70V50q0-10 10-10t10 10v36q0 18-18 18H62q-14 0-22-12l-10-16q-4-8 4-12t12 4l8 12" fill="#F7C7AE" stroke="#E3A55A" stroke-width="3"/>'
};
function personSVG(color) { return `<circle cx="60" cy="42" r="22" fill="${color}"/><path d="M18 112q0-40 42-40t42 40z" fill="${color}"/>`; }
function placeholderSVG(word) {
  const body = ICONS[word.id] || (word.group === 'ადამიანები' ? personSVG(word.id === 'deda' ? '#F4A3A0' : word.id === 'mama' ? '#4FB3C8' : '#C9B6E4') : '<circle cx="60" cy="60" r="40" fill="#CDEFF5"/>');
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" fill="#EAF6FA"/>${body}</svg>`;
}
async function photoNode(word, photoIndex) {
  const p = (word.photos || [])[photoIndex];
  if (p && p.src) { const img = el('img', { alt: '' }); img.src = p.src; return img; } // bundled seed photo
  if (p && p.key) {
    const u = await blobURL(p.key);
    if (u) { const img = el('img', { alt: '' }); img.src = u; return img; }
  }
  const d = el('div'); d.innerHTML = placeholderSVG(word); return d.firstChild;
}

// ---------------------------------------------------------------- audio
let audioCtx = null;
function tone(freq = 660, ms = 220) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000);
  } catch (e) { /* no audio */ }
}
async function playWord(word, { slow = false } = {}) {
  if (TEST) return wait(30);
  const key = word.audioKey;
  if (key) {
    const u = await blobURL(key);
    if (u) return new Promise(res => { const a = new Audio(u); a.playbackRate = slow ? 0.8 : 1; a.onended = res; a.onerror = res; a.play().catch(res); setTimeout(res, 6000); });
  }
  if ('speechSynthesis' in window) {
    const voices = speechSynthesis.getVoices();
    const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith('ka')) || voices.find(x => x.lang && x.lang.toLowerCase().startsWith('ru'));
    if (v) return new Promise(res => { const u = new SpeechSynthesisUtterance(word.ka); u.voice = v; u.rate = slow ? 0.7 : 0.85; u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 4000); });
  }
  tone(slow ? 520 : 660, 300); await wait(900);
}

// ---------------------------------------------------------------- state
const state = { screen: null, session: null, trialState: null, timers: [], holdTimer: null, pin: '', period: 'week', tab: 'today', wordDetail: null };
function clearTimers() { for (const t of state.timers) clearTimeout(t); state.timers = []; }
function later(fn, ms) { const t = setTimeout(fn, ms); state.timers.push(t); return t; }
function logEvent(e) { store.log.push(e); save(); }

// ---------------------------------------------------------------- lock + pin
function wireLocks() {
  // One tap opens the PIN pad (owner's decision 2026-10-19); the PIN itself protects the panel.
  for (const b of $$('[data-lock], #lock-home')) {
    b.addEventListener('click', openPin);
    b.addEventListener('contextmenu', e => e.preventDefault()); // iPad long-press menu
  }
  const keys = $('#pinkeys');
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', 'OK']) {
    keys.appendChild(el('button', { type: 'button', 'data-key': k, onclick: () => pinKey(k) }, k));
  }
  $('#pin-cancel').addEventListener('click', closePin);
}
function openPin() { state.pin = ''; renderPin(); $('#pin-error').classList.add('hidden'); $('#pinpad').classList.add('active'); }
function closePin() { $('#pinpad').classList.remove('active'); }
function renderPin() { $$('#pindots i').forEach((d, i) => d.classList.toggle('on', i < state.pin.length)); }
function pinKey(k) {
  if (k === '←') state.pin = state.pin.slice(0, -1);
  else if (k === 'OK') { if (state.pin === store.settings.pin) { closePin(); openParent(); } else { $('#pin-error').classList.remove('hidden'); state.pin = ''; } }
  else if (state.pin.length < 4) state.pin += k;
  renderPin();
  if (state.pin.length === 4 && k !== 'OK') { if (state.pin === store.settings.pin) { closePin(); openParent(); } else { $('#pin-error').classList.remove('hidden'); state.pin = ''; renderPin(); } }
}

// ---------------------------------------------------------------- onboarding
function wireOnboarding() {
  const f = $('#onb-form');
  let gender = null, lang = 'ka', lang2 = 'none';
  const pick = (id, cb) => $$(`#${id} button`).forEach(b => b.addEventListener('click', () => { $$(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v); }));
  pick('onb-gender', v => gender = v); pick('onb-lang', v => lang = v); pick('onb-lang2', v => lang2 = v);
  $('#onb-birth').addEventListener('change', () => $('#onb-age').value = ageText($('#onb-birth').value) || '—');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#onb-name').value.trim(); const birth = $('#onb-birth').value; const pin = $('#onb-pin').value;
    if (!name || !birth) { toast('სახელი და დაბადების თარიღი აუცილებელია'); return; }
    if (!/^[0-9]{4}$/.test(pin)) { toast('PIN 4 ციფრი უნდა იყოს'); return; }
    store.profile = { name, gender, birth, lang, lang2, createdAt: now() };
    store.settings.pin = pin; store.settings.language = lang;
    save(); renderHome(); show('s-home'); toast(`გამარჯობა, ${name}!`);
  });
}

// ---------------------------------------------------------------- home
function renderHome() {
  const p = store.profile;
  $('#home-title').textContent = p ? p.name : 'სიტყვა';
  const n = nextSession(store.plan);
  $('#home-next').textContent = n ? `შემდეგი სესია: ${new Date(n.at).toLocaleString('ka-GE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : 'კალენდარი არ არის დაყენებული';
  const list = $('#home-words'); list.innerHTML = '';
  const ready = usableWords(store.words, store.settings);
  const missing = store.words.filter(w => w.enabled !== false && !w.paused && w.photoTask !== false && !ready.includes(w)).length;
  $('#btn-start').disabled = ready.length < 2;
  if (ready.length < 2) {
    list.appendChild(el('span', { class: 'w' }, `სესიისთვის საჭიროა ფოტო მინიმუმ 2 სიტყვას. დაამატე ფოტოები მშობლის რეჟიმში → „სიტყვები“ (${missing} სიტყვას ფოტო აკლია).`));
  }
  const plan = ready.length >= 2 ? planSession(store.words, store.log, store.settings, makeRng(now() & 0xffff)) : { trials: [] };
  const ids = [...new Set(plan.trials.map(t => t.wordId))];
  for (const id of ids) { const w = wordById(id); list.appendChild(el('span', { class: 'w' + (masteryOf(id, store.log).mastered ? ' known' : '') }, w.ka)); }
  const s = store.settings;
  $('#home-rules').textContent = `${s.trialsPerSession} ცდა · ლოდინი ${s.choiceWaitMs / 1000} წმ · ნამდვილი საგანი ყოველ ${s.realObjectEvery} ცდაში · ჯილდო ${s.rewardsEnabled ? `${s.rewardAfterCorrect} სწორის შემდეგ` : 'გამორთულია (1-ლი კვირა)'}`;
  mountChiku('#home-chiku', { size: 150, mood: 'wave' });
}
function mountChiku(sel, opts) {
  const slot = $(sel); slot.innerHTML = '';
  slot.appendChild(createChiku({ ...opts, motion: store.settings.motion, onTap: () => logEvent({ type: 'freeplay', itemId: 'chiku', t: now() }) }));
}

// ---------------------------------------------------------------- session
async function startSession() {
  clearTimers();
  if (usableWords(store.words, store.settings).length < 2) { renderHome(); return; }
  const plan = planSession(store.words, store.log, store.settings, TEST ? makeRng(42) : Math.random);
  state.session = { id: 's' + now(), startedAt: now(), plan, trialIndex: 0, correct: 0, correctSinceReward: 0, characterId: null, rewardsShown: 0, refusals: 0, trialsDone: 0, shownCharacterIds: [] };
  const cards = chooseCharacterCards(store.characters, store.log, store.rotation);
  if (store.settings.rewardsEnabled && cards.length) { state.session.shownCharacterIds = cards.map(c => c.id); renderChoice(cards); show('s-choice'); }
  else runTrial();
}
function renderChoice(cards) {
  const box = $('#choice-cards'); box.innerHTML = '';
  cards.forEach((c, i) => {
    const b = el('button', { class: 'card float' + (i === 1 ? ' d2' : i === 2 ? ' d3' : ''), 'aria-label': c.name, onclick: () => { state.session.characterId = c.id; store.rotation += 1; save(); runTrial(); } });
    const inner = el('div', { class: 'inner' }); inner.style.background = ['#9ED8E4', '#F7C7AE', '#D3C8EE'][i % 3];
    const clip = (c.clips || [])[0];
    if (clip && clip.youtubeId) { const img = el('img', { alt: '' }); img.src = `https://i.ytimg.com/vi/${clip.youtubeId}/hqdefault.jpg`; img.onerror = () => { img.replaceWith(playIcon()); }; inner.appendChild(img); }
    else inner.appendChild(playIcon());
    b.appendChild(inner); b.appendChild(el('div', { class: 'label' }, c.name));
    box.appendChild(b);
  });
  mountChiku('#choice-chiku', { size: 170, mood: 'wave' });
}
function playIcon() { const d = el('div'); d.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="38" fill="#fff"/><path d="M48 40l30 20-30 20z" fill="#2E8FA3"/></svg>'; return d.firstChild; }

function renderProgress(sel) {
  const s = state.session; const box = $(sel); box.innerHTML = '';
  for (let i = 0; i < s.plan.trials.length; i++) { const d = el('div', { class: 'dot' + (i < s.correct ? ' on' : '') }); if (i < s.correct) d.innerHTML = starSVG; box.appendChild(d); }
}

async function runTrial() {
  const s = state.session;
  if (!s) return;
  if (s.trialIndex >= s.plan.trials.length || now() - s.startedAt > store.settings.sessionMaxMs) return endSession(true);
  const trial = s.plan.trials[s.trialIndex];
  const target = wordById(trial.wordId), distractor = wordById(trial.distractorId);
  state.trialState = initialTrialState(trial, now());
  show('s-trial');
  renderProgress('#trial-progress');
  $('#trial-word').textContent = `„${target.ka}“`;
  $('#trial-bubble').classList.add('pulse');
  $('#trial-caption').textContent = 'შეხება იხსნება ხმის შემდეგ';
  mountChiku('#trial-chiku', { size: 110, mood: 'listen' });
  const cards = $('#trial-cards'); cards.innerHTML = '';
  const sides = [null, null];
  sides[trial.targetSide] = { word: target, photoIndex: trial.photoIndex, isTarget: true };
  sides[1 - trial.targetSide] = { word: distractor, photoIndex: trial.distractorPhotoIndex ?? 0, isTarget: false };
  for (let side = 0; side < 2; side++) {
    const c = sides[side];
    const b = el('button', { class: 'card locked', 'data-side': side, 'data-target': c.isTarget ? '1' : '0', 'aria-label': c.isTarget ? `ფოტო: ${c.word.ka}` : `ფოტო: ${c.word.ka}` });
    const inner = el('div', { class: 'inner' }); inner.appendChild(await photoNode(c.word, c.photoIndex)); b.appendChild(inner);
    b.addEventListener('click', () => onTap(side));
    cards.appendChild(b);
  }
  await playWord(target);
  dispatch({ type: 'AUDIO_END', t: now() });
}
function dispatch(ev) {
  const before = state.trialState; if (!before || before.phase === 'done') return;
  const after = trialReducer(before, ev); state.trialState = after;
  if (after.phase !== before.phase) onPhase(after, before);
}
function onPhase(st) {
  const cards = $$('#trial-cards .card');
  if (st.phase === 'wait') {
    cards.forEach(c => c.classList.remove('locked'));
    $('#trial-bubble').classList.remove('pulse');
    $('#trial-caption').textContent = 'ვუცდით…';
    later(() => dispatch({ type: 'TIMEOUT' }), store.settings.choiceWaitMs);
  } else if (st.phase === 'hint') {
    clearTimers();
    $('#trial-caption').textContent = 'მინიშნება: სწორი ფოტო იზრდება, ჭიკუ მიუთითებს';
    cards.forEach(c => { c.classList.remove('locked'); c.classList.toggle('hint', c.dataset.target === '1'); c.classList.toggle('dim', c.dataset.target !== '1'); });
    mountChiku('#trial-chiku', { size: 110, mood: 'point' });
    const target = wordById(st.trial.wordId); playWord(target, { slow: true });
    later(() => { if (state.trialState && state.trialState.phase === 'hint') { dispatch({ type: 'ABORT' }); finishTrial(); } }, store.settings.vocalWaitMs * 3);
  } else if (st.phase === 'feedback') {
    clearTimers();
    cards.forEach(c => { c.classList.add('locked'); c.classList.remove('hint', 'dim'); if (c.dataset.target === '1') { c.classList.add('correct'); const b = el('div', { class: 'badge' }); b.innerHTML = checkSVG; c.appendChild(b); } else c.classList.add('dim'); });
    mountChiku('#trial-chiku', { size: 110, mood: 'happy' });
    const target = wordById(st.trial.wordId);
    $('#trial-caption').textContent = `„${target.ka}! ყოჩაღ.“`;
    tone(880, 180);
    state.session.correct += 1; state.session.correctSinceReward += 1;
    renderProgress('#trial-progress');
    later(() => { dispatch({ type: 'FEEDBACK_END' }); finishTrial(); }, store.settings.feedbackMs);
  }
}
function onTap(side) { dispatch({ type: 'TAP', side, t: now() }); }
function finishTrial() {
  const st = state.trialState, s = state.session; if (!st || !s) return;
  const rec = { type: 'trial', sessionId: s.id, t: now(), wordId: st.trial.wordId, distractorId: st.trial.distractorId, photoIndex: st.trial.photoIndex, photoId: st.trial.photoId ?? null, distractorPhotoId: st.trial.distractorPhotoId ?? null, response: st.response || 'none', latencyMs: st.latencyMs, taps: st.taps, wrongTaps: st.wrongTaps, hinted: st.hinted, targetSide: st.trial.targetSide };
  s.lastTrialRecord = rec; logEvent(rec); s.trialsDone += 1;
  const idx = s.trialIndex; s.trialIndex += 1; state.trialState = null;
  if (shouldPauseForRealObject(idx, store.settings)) return showRealObject(rec);
  afterPause();
}
function afterPause() {
  const s = state.session;
  if (shouldReward(s.correctSinceReward, store.settings) && s.characterId) { s.correctSinceReward = 0; return showReward(); }
  runTrial();
}
async function showRealObject(rec) {
  const w = wordById(rec.wordId);
  show('s-real'); renderProgress('#real-progress');
  $('#real-title').textContent = `აჩვენე ნამდვილი „${w.ka}“, თქვი და დაელოდე 5 წამი`;
  const inner = $('#real-card .inner'); inner.innerHTML = ''; inner.appendChild(await photoNode(w, rec.photoIndex));
  mountChiku('#real-chiku', { size: 150, mood: 'point' });
  const done = v => { rec.realObject = v; save(); afterPause(); };
  $('#real-tried').onclick = () => done('tried'); $('#real-notyet').onclick = () => done('not_yet');
}
function showReward() {
  const s = state.session; const c = charById(s.characterId);
  show('s-reward'); renderProgress('#reward-progress');
  const clips = (c.clips || []).filter(x => x.enabled !== false);
  const clip = clips.length ? clips[s.rewardsShown % clips.length] : null;
  s.rewardsShown += 1;
  const scr = $('#reward-screen'); scr.innerHTML = '';
  const bar = $('#reward-bar'); bar.classList.remove('run'); void bar.offsetWidth;
  let ms = TEST ? 800 : 7000;
  if (clip && clip.youtubeId && navigator.onLine && !TEST) {
    ms = Math.max(3000, (clip.end - clip.start) * 1000 + 800);
    const f = el('iframe', { allow: 'autoplay; encrypted-media', title: `${c.name}: სიუჟეტი`, referrerpolicy: 'strict-origin-when-cross-origin' });
    f.src = `https://www.youtube-nocookie.com/embed/${clip.youtubeId}?start=${clip.start}&end=${clip.end}&autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&disablekb=1`;
    scr.appendChild(f);
    $('#reward-label').textContent = `${c.name} · სიუჟეტი ${((s.rewardsShown - 1) % clips.length) + 1}/${clips.length}`;
  } else if (clip && clip.blobKey && !TEST) {
    ms = Math.max(3000, (clip.end - clip.start) * 1000 + 800);
    blobURL(clip.blobKey).then(u => { const v = el('video', { playsinline: '', autoplay: '' }); v.src = u + `#t=${clip.start},${clip.end}`; v.muted = false; v.style.cssText = 'width:100%;height:100%;object-fit:cover'; scr.appendChild(v); v.play().catch(() => {}); });
    $('#reward-label').textContent = `${c.name} · საკუთარი ვიდეო`;
  } else {
    const d = el('div', { class: 'chiku-slot', style: 'position:static' }); scr.appendChild(d);
    d.appendChild(createChiku({ size: 220, mood: 'wave', motion: store.settings.motion }));
    $('#reward-label').textContent = clip ? `${c.name} · ინტერნეტი არ არის, ჭიკუ ცეკვავს` : `${c.name} · სიუჟეტი ჯერ არ დამატებულა`;
  }
  bar.style.animationDuration = ms + 'ms'; bar.classList.add('run');
  mountChiku('#reward-chiku', { size: 140, mood: 'listen' });
  later(() => { scr.innerHTML = ''; runTrial(); }, ms);
}
function endSession(completed, reason) {
  clearTimers();
  const s = state.session; if (!s) return;
  const rec = { type: 'session', id: s.id, startedAt: s.startedAt, durationMs: now() - s.startedAt, completed, reason: reason || null, refusals: s.refusals, characterId: s.characterId, trialsPlanned: s.plan.trials.length, trialsDone: s.trialsDone, correct: s.correct, rewardsShown: s.rewardsShown, calmAfterReward: null, distress: reason === 'distress', shownCharacterIds: s.shownCharacterIds || [] };
  logEvent(rec); s.record = rec;
  show('s-done'); renderProgress('#done-progress');
  mountChiku('#done-chiku', { size: 200, mood: 'wave' });
  tone(784, 200); setTimeout(() => tone(988, 300), 220);
  const panel = $('#done-panel'); panel.classList.add('hidden');
  later(() => {
    panel.classList.remove('hidden');
    $('#done-title').textContent = `${fmtMin(rec.durationMs)} · ${s.trialsDone} ცდა · ${s.correct} სწორი`;
    $('#done-sub').textContent = s.rewardsShown ? 'როგორი იყო სიუჟეტის დასრულებისას?' : 'როგორ დასრულდა სესია?';
    const bx = $('#done-buttons'); bx.innerHTML = '';
    bx.appendChild(el('button', { class: 'btn', onclick: () => closeSession(true) }, 'მშვიდად'));
    bx.appendChild(el('button', { class: 'btn secondary', onclick: () => closeSession(false) }, 'გაღიზიანდა'));
  }, TEST ? 100 : 3000);
}
function closeSession(calm) {
  const s = state.session; if (s && s.record) { s.record.calmAfterReward = s.rewardsShown ? calm : null; if (!calm) s.record.distress = true; save(); }
  state.session = null; renderHome(); show('s-home');
}
function abortSession(reason) {
  const s = state.session; if (!s) return;
  if (state.trialState && state.trialState.phase !== 'done') { dispatch({ type: 'ABORT' }); logEvent({ type: 'trial', sessionId: s.id, t: now(), wordId: state.trialState.trial.wordId, distractorId: state.trialState.trial.distractorId, photoIndex: state.trialState.trial.photoIndex, photoId: state.trialState.trial.photoId ?? null, distractorPhotoId: state.trialState.trial.distractorPhotoId ?? null, targetSide: state.trialState.trial.targetSide, wrongTaps: state.trialState.wrongTaps, response: 'none', taps: state.trialState.taps, hinted: state.trialState.hinted }); state.trialState = null; }
  if (reason === 'refusal') s.refusals += 1;
  endSession(false, reason);
}

// ---------------------------------------------------------------- parent panel
function openParent() { show('s-parent'); selectTab(state.session ? 'today' : (state.tab || 'today')); }
function selectTab(name) {
  state.tab = name;
  $$('#tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  for (const t of ['today', 'stats', 'words', 'library', 'calendar', 'questions', 'suggestions', 'settings']) $('#tab-' + t).classList.toggle('hidden', t !== name);
  ({ today: renderToday, stats: renderStats, words: renderWords, library: renderLibrary, calendar: renderCalendar, questions: renderQuestions, suggestions: renderSuggestions, settings: renderSettings })[name]();
}
function wireParent() {
  $$('#tabs .tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));
  $('#btn-child').addEventListener('click', () => { if (state.session) show(state.trialState ? 's-trial' : 's-home'); else { renderHome(); show('s-home'); } });
  $('#btn-start').addEventListener('click', startSession);
}
function tile(v, l) { return el('div', { class: 'tile' }, el('div', { class: 'v' }, String(v)), el('div', { class: 'l' }, l)); }

function renderToday() {
  const box = $('#tab-today'); box.innerHTML = '';
  const day = aggregate(store.log, 'day'); const s = state.session;
  if (s) {
    box.appendChild(el('div', { class: 'note' }, `სესია მიმდინარეობს: ${s.trialsDone} ცდა შესრულდა, ${s.correct} სწორი. შეწყვეტა ქვემოთ, მიზეზით.`));
    box.appendChild(el('div', { class: 'row', style: 'margin:10px 0' },
      el('button', { class: 'btn secondary', onclick: () => { abortSession('refusal'); } }, 'შეწყვეტა: უარი თქვა'),
      el('button', { class: 'btn secondary', onclick: () => { abortSession('distress'); } }, 'შეწყვეტა: გაღიზიანდა'),
      el('button', { class: 'btn secondary', onclick: () => { abortSession('other'); } }, 'შეწყვეტა: სხვა მიზეზი')));
  }
  box.appendChild(el('div', { class: 'grid4' }, tile(day.sessions, 'სესია დღეს'), tile(day.minutes, 'წუთი'), tile(day.trials, 'ცდა'), tile(day.independentPct + '%', 'თავად, სწორად')));
  const gate = gateStatus(store.log).gate1;
  box.appendChild(el('div', { class: 'box', style: 'margin-top:12px' }, el('h2', { style: 'margin-top:0' }, 'შემოწმება 1: მოსწონს?'),
    el('div', { class: 'row' }, el('span', { class: 'chip ' + (gate.pass ? 'ok' : 'warn') }, gate.pass ? 'ზღვარი გადალახულია' : 'ჯერ არა'), el('span', {}, `ბოლო 14 დღეში ${gate.daysWithSession} დღე სესიით (≥ 2 წთ), მშვიდი დასასრული ${gate.calmPct}%`)),
    el('div', { class: 'small', style: 'margin-top:6px' }, 'ზღვარი: ≥ 7 დღე და ≥ 80% მშვიდი დასასრული. შეწყვეტის ზღვარი: ორ სესიაზე ძლიერი გაღიზიანება ან ტაბლეტისადმი უარყოფითი დამოკიდებულება.')));
  const n = nextSession(store.plan);
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'დღის დავალება ეკრანის გარეშე'),
    el('div', {}, `სადილზე „${(wordById('tsqali') || {}).ka || 'წყალი'}“: ჭიქა მაგიდაზე დადე და დაელოდე 5 წამი. აჩვენებს თუ მიწვდება?`),
    el('div', { class: 'row', style: 'margin-top:10px' }, el('button', { class: 'btn', onclick: () => { logEvent({ type: 'task', t: now(), result: 'self' }); toast('ჩაიწერა'); } }, 'გააკეთა თავად'), el('button', { class: 'btn secondary', onclick: () => { logEvent({ type: 'task', t: now(), result: 'helped' }); toast('ჩაიწერა'); } }, 'დახმარებით')),
    el('div', { class: 'small', style: 'margin-top:10px' }, n ? `შემდეგი სესია: ${new Date(n.at).toLocaleString('ka-GE')}` : 'კალენდარი ცარიელია')));
  const sessions = store.log.filter(e => e.type === 'session').slice(-10).reverse();
  const tb = el('table', {}, el('thead', {}, el('tr', {}, ...['დრო', 'ხანგრძლივობა', 'ცდები', 'სწორი', 'ჯილდო', 'დასასრული'].map(h => el('th', {}, h)))));
  const body = el('tbody'); tb.appendChild(body);
  for (const s of sessions) body.appendChild(el('tr', {}, el('td', {}, new Date(s.startedAt).toLocaleString('ka-GE')), el('td', {}, fmtMin(s.durationMs || 0)), el('td', {}, `${s.trialsDone}/${s.trialsPlanned}`), el('td', {}, String(s.correct ?? '')), el('td', {}, s.characterId ? (charById(s.characterId) || {}).name || s.characterId : '—'), el('td', {}, s.distress ? 'გაღიზიანდა' : s.completed ? 'მშვიდად' : (s.reason === 'refusal' ? 'უარი' : 'შეწყდა'))));
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'ბოლო სესიები'), sessions.length ? tb : el('div', { class: 'small' }, 'ჯერ სესია არ ყოფილა')));
}

// ---- charts (inline SVG) ----
function barChart(items, { width = 720, height = 220, color = 'var(--c1)', unit = '' } = {}) {
  const max = Math.max(1, ...items.map(i => i.value));
  const pad = { l: 36, r: 8, t: 10, b: 28 }; const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const bw = Math.min(40, w / items.length * 0.7);
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="სვეტოვანი დიაგრამა">`;
  for (let g = 0; g <= 4; g++) { const y = pad.t + h - h * g / 4; s += `<line class="axis" x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${Math.round(max * g / 4)}</text>`; }
  items.forEach((it, i) => {
    const x = pad.l + (i + 0.5) * (w / items.length) - bw / 2; const bh = h * it.value / max; const y = pad.t + h - bh;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${it.color || color}"><title>${it.label}: ${it.value}${unit}</title></rect>`;
    if (items.length <= 16 || i % Math.ceil(items.length / 12) === 0) s += `<text x="${x + bw / 2}" y="${height - 8}" text-anchor="middle">${it.label}</text>`;
    if (it.value && items.length <= 12) s += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle">${it.value}${unit}</text>`;
  });
  return s + '</svg>';
}
function lineChart(series, { width = 720, height = 220, max = 100, unit = '%' } = {}) {
  const pad = { l: 36, r: 8, t: 10, b: 28 }; const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="ხაზოვანი დიაგრამა">`;
  for (let g = 0; g <= 4; g++) { const y = pad.t + h - h * g / 4; s += `<line class="axis" x1="${pad.l}" x2="${width - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${Math.round(max * g / 4)}</text>`; }
  for (const ser of series) {
    const pts = ser.points.map((p, i) => p.value == null ? null : [pad.l + (i + 0.5) * (w / ser.points.length), pad.t + h - h * Math.min(max, p.value) / max]);
    const d = pts.map((p, i) => p ? `${i && pts[i - 1] ? 'L' : 'M'}${p[0]} ${p[1]}` : '').join(' ');
    s += `<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="2"/>`;
    pts.forEach((p, i) => { if (p) s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${ser.color}" stroke="#fff" stroke-width="2"><title>${ser.name}: ${ser.points[i].label} ${ser.points[i].value}${unit}</title></circle>`; });
    ser.points.forEach((p, i) => { s += `<text x="${pad.l + (i + 0.5) * (w / ser.points.length)}" y="${height - 8}" text-anchor="middle">${p.label}</text>`; });
  }
  return s + '</svg>';
}
function heatmap(heat) {
  const days = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'];
  const hours = [...Array(14)].map((_, i) => i + 8);
  const box = el('div', { class: 'heat' }, el('div'), ...hours.map(h => el('div', { style: 'text-align:center' }, String(h))));
  days.forEach((d, di) => {
    box.appendChild(el('div', {}, d));
    for (const h of hours) {
      const c = heat[`${di}-${h}`]; const cell = el('div', { class: 'cell', title: c ? `${d} ${h}:00 · ${c.n} ცდა, ${Math.round(100 * c.indep / c.n)}% თავად` : '' });
      if (c) { const p = c.indep / c.n; cell.style.background = `rgba(14,143,176,${0.25 + 0.75 * p})`; }
      box.appendChild(cell);
    }
  });
  return box;
}

function renderStats() {
  const box = $('#tab-stats'); box.innerHTML = '';
  const seg = el('div', { class: 'seg' }, ...[['day', 'დღე'], ['week', 'კვირა'], ['month', 'თვე'], ['year', 'წელი']].map(([k, l]) => el('button', { class: k === state.period ? 'on' : '', 'data-period': k, onclick: () => { state.period = k; renderStats(); } }, l)));
  box.appendChild(el('div', { class: 'row between' }, el('h2', { style: 'margin:0' }, 'სტატისტიკა'), seg));
  if (state.wordDetail) return renderWordDetail(box);
  const a = aggregate(store.log, state.period);
  box.appendChild(el('div', { class: 'grid4', style: 'margin-top:12px' }, tile(a.sessions, 'სესია'), tile(a.minutes, 'წუთი სულ'), tile(a.trials, 'ცდა'), tile(a.independentPct + '%', 'თავად, სწორად'), tile(a.completed, 'დასრულებული'), tile(a.refusals, 'უარი'), tile(a.realObjectAsked ? `${a.realObjectTried}/${a.realObjectAsked}` : '—', 'ნამდვილ საგანზე სცადა'), tile(Object.keys(a.perWord).length, 'სიტყვა ვარჯიშში')));
  // minutes per day
  const days = []; const n = state.period === 'day' ? 1 : state.period === 'week' ? 7 : state.period === 'month' ? 30 : 12;
  if (state.period === 'year') {
    for (let m = 0; m < 12; m++) { const label = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'][m]; let v = 0; for (const [k, mins] of Object.entries(a.perDay)) if (Number(k.slice(5, 7)) === m + 1) v += mins; days.push({ label, value: Math.round(v) }); }
  } else {
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d.getTime()); days.push({ label: `${d.getDate()}`, value: Math.round((a.perDay[k] || 0) * 10) / 10 }); }
  }
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, state.period === 'year' ? 'წუთები თვეების მიხედვით' : 'წუთები დღეების მიხედვით'), el('div', { html: barChart(days, { unit: '' }) })));
  // words table
  const rows = Object.values(a.perWord).sort((x, y) => (y.medianLatencyMs || 0) - (x.medianLatencyMs || 0));
  const tb = el('table', {}, el('thead', {}, el('tr', {}, ...['სიტყვა', 'დონე', 'ცდა', 'თავად', 'მინიშნებით', 'უპასუხოდ', 'პასუხის დრო (მედიანა)', ''].map(h => el('th', {}, h)))));
  const body = el('tbody'); tb.appendChild(body);
  for (const r of rows) { const w = wordById(r.wordId) || { ka: r.wordId }; body.appendChild(el('tr', {}, el('td', { style: 'font-weight:700' }, w.ka), el('td', {}, String(w.level ?? 0)), el('td', {}, String(r.trials)), el('td', {}, `${r.independent} (${r.independentPct}%)`), el('td', {}, String(r.prompted)), el('td', {}, String(r.none)), el('td', {}, r.medianLatencyMs != null ? `${r.medianLatencyMs} მწ` : '—'), el('td', {}, el('button', { class: 'tab', onclick: () => { state.wordDetail = r.wordId; renderStats(); } }, 'დეტალი')))); }
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'სიტყვები: რომელი უმარტივდება, რომელი ურთულდება (ზემოთ ყველაზე ნელი)'), rows.length ? tb : el('div', { class: 'small' }, 'ამ პერიოდში ცდები არ არის')));
  // latency bars
  if (rows.length) box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'პასუხის დრო სიტყვების მიხედვით, მწ'), el('div', { html: barChart(rows.map(r => ({ label: (wordById(r.wordId) || { ka: r.wordId }).ka, value: r.medianLatencyMs || 0, color: r.independentPct >= 80 ? 'var(--c1)' : r.independentPct >= 40 ? 'var(--c2)' : 'var(--neutral)' })), { unit: '' }) }), el('div', { class: 'legend' }, el('span', { html: '<i style="background:var(--c1)"></i>თავად ≥ 80%' }), el('span', { html: '<i style="background:var(--c2)"></i>40–79%' }), el('span', { html: '<i style="background:var(--neutral)"></i>&lt; 40%' }))));
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'როდის მიდის უკეთ: დღე × საათი (მუქი = მეტი თავად სწორი)'), heatmap(a.heat)));
  const ch = Object.entries(a.perCharacter);
  if (ch.length) {
    const t = el('table', {}, el('thead', {}, el('tr', {}, ...['პერსონაჟი', 'არჩეული', 'მშვიდად', 'გაღიზიანდა'].map(h => el('th', {}, h)))));
    const b = el('tbody'); t.appendChild(b);
    for (const [id, c] of ch) b.appendChild(el('tr', {}, el('td', {}, (charById(id) || { name: id }).name), el('td', {}, String(c.chosen)), el('td', {}, String(c.calm)), el('td', {}, String(c.upset))));
    box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'ჯილდო: ვის ირჩევს'), t));
  }
  box.appendChild(el('div', { class: 'row' }, el('button', { class: 'tab', onclick: () => download('sitkva-log.csv', toCSV(store.log), 'text/csv') }, 'CSV ექსპორტი'), el('button', { class: 'tab', onclick: () => download('sitkva-backup.json', JSON.stringify(store), 'application/json') }, 'სარეზერვო ასლი (JSON)'), el('button', { class: 'tab', onclick: () => window.print() }, 'PDF ლოგოპედისთვის (ბეჭდვა)')));
}
function renderWordDetail(box) {
  const w = wordById(state.wordDetail); const tr = wordTrend(w.id, store.log);
  box.appendChild(el('div', { class: 'row', style: 'margin:12px 0' }, el('button', { class: 'tab', onclick: () => { state.wordDetail = null; renderStats(); } }, '← ყველა სიტყვა'), el('h2', { style: 'margin:0' }, `„${w.ka}“`), el('span', { class: 'chip' }, `დონე ${w.level ?? 0}`), el('span', { class: 'chip' }, w.group)));
  const labels = tr.map(t => new Date(t.weekStart).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' }));
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'თავად სწორი პასუხი, % კვირების მიხედვით (8 კვირა)'), el('div', { html: lineChart([{ name: 'თავად', color: 'var(--c1)', points: tr.map((t, i) => ({ label: labels[i], value: t.independentPct })) }]) })));
  const maxL = Math.max(1000, ...tr.map(t => t.medianLatencyMs || 0));
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'პასუხის დრო, მწ (მედიანა კვირაში)'), el('div', { html: lineChart([{ name: 'დრო', color: 'var(--c2)', points: tr.map((t, i) => ({ label: labels[i], value: t.medianLatencyMs })) }], { max: Math.ceil(maxL / 500) * 500, unit: ' მწ' }) })));
  // photos: selection rate when target
  const trials = store.log.filter(e => e.type === 'trial' && e.wordId === w.id);
  const ph = el('div', { class: 'thumbs' });
  const count = Math.max(1, (w.photos || []).length);
  for (let i = 0; i < count; i++) {
    const ts = trials.filter(t => (t.photoIndex ?? 0) === i); const ind = ts.filter(t => t.response === 'independent').length;
    const th = el('div', { class: 'thumb' + ((w.photos || [])[i] && w.photos[i].off ? ' off' : '') }); photoNode(w, i).then(n => th.appendChild(n));
    ph.appendChild(el('div', {}, th, el('div', { class: 'small', style: 'text-align:center' }, ts.length ? `${ind}/${ts.length} თავად` : 'ჯერ არა')));
  }
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'ფოტოები: რომელს ცნობს'), ph));
  const real = trials.filter(t => t.realObject);
  box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'ნამდვილ საგანზე'), el('div', {}, real.length ? `${real.filter(t => t.realObject === 'tried').length} სცადა თავად, ${real.filter(t => t.realObject === 'not_yet').length} ჯერ არა` : 'ჯერ არ შემოწმებულა')));
}
async function download(name, text, type) {
  // Inside a claude.ai artifact the viewer saves through the downloads capability (csv/json); elsewhere a plain download link.
  const ext = name.split('.').pop();
  if (window.claude && typeof window.claude.use === 'function' && ['csv', 'json', 'txt', 'html', 'md'].includes(ext)) {
    try { const d = await window.claude.use('downloads'); if (d) { await d.save({ filename: name, data: text }); return; } } catch (e) { if (e && e.code === 'declined') return; }
  }
  const b = new Blob([text], { type }); const u = URL.createObjectURL(b); const a = el('a', { href: u, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}

// ---- words ----
function renderWords() {
  const box = $('#tab-words'); box.innerHTML = '';
  box.appendChild(el('div', { class: 'note' }, 'ყველა 26 სიტყვა განვითარების რიგითაა. ჩართე ის, რაც ლოგოპედთან შეთანხმდა; თითო სიტყვაზე 3–5 ფოტო და მშობლის ხმა. წარმოთქმის სირთულე მხოლოდ მიბაძვის მოდულზე მოქმედებს.'));
  const t = el('table', {}, el('thead', {}, el('tr', {}, ...['#', 'სიტყვა', 'ჯგუფი', 'წარმოთქმა', 'ჩართულია', 'დონე', 'ფოტოები', 'ხმა', 'სტატუსი'].map(h => el('th', {}, h)))));
  const body = el('tbody'); t.appendChild(body);
  for (const w of store.words.slice().sort((a, b) => a.order - b.order)) {
    const m = masteryOf(w.id, store.log);
    const ease = { easy: 'ადვილი', mid: 'საშუალო', hard: 'რთული' }[w.ease];
    const chk = el('input', { type: 'checkbox', 'aria-label': `ჩართე ${w.ka}` }); chk.checked = w.enabled !== false; chk.addEventListener('change', () => { w.enabled = chk.checked; save(); renderHome(); });
    const lvl = el('select', { 'aria-label': 'დონე' }, ...[0, 1, 2, 3].map(l => { const o = el('option', { value: l }, `${l}`); if ((w.level ?? 0) === l) o.selected = true; return o; })); lvl.style.width = '80px'; lvl.addEventListener('change', () => { w.level = Number(lvl.value); save(); });
    const thumbs = el('div', { class: 'thumbs' });
    (w.photos || []).forEach((p, i) => { const th = el('div', { class: 'thumb' + (p.off ? ' off' : '') }); photoNode(w, i).then(n => th.appendChild(n)); th.appendChild(el('button', { 'aria-label': 'წაშლა', onclick: async () => { if (!confirm('წავშალოთ ფოტო?')) return; await idb.del(p.key); w.photos.splice(i, 1); save(); renderWords(); } }, '×')); thumbs.appendChild(th); });
    const file = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden', 'aria-label': `ფოტოს დამატება: ${w.ka}` });
    file.addEventListener('change', async () => { const f = file.files[0]; if (!f) return; const blob = await resizeImage(f, 900); const key = `${w.id}:photo:${now()}`; await idb.put(key, blob); (w.photos = w.photos || []).push({ key }); save(); renderWords(); toast('ფოტო დაემატა'); });
    const addBtn = el('button', { class: 'tab', onclick: () => file.click() }, '+ ფოტო');
    const rec = el('button', { class: 'tab', onclick: () => recordAudio(w, rec) }, w.audioKey ? '● ხელახლა' : '● ჩაწერა');
    const play = el('button', { class: 'tab', onclick: () => playWord(w), 'aria-label': `მოსმენა ${w.ka}` }, '▶');
    body.appendChild(el('tr', {}, el('td', {}, String(w.order)), el('td', { style: 'font-weight:800; font-size:18px' }, w.ka), el('td', {}, w.group), el('td', {}, ease), el('td', {}, chk), el('td', {}, lvl), el('td', {}, el('div', { class: 'row' }, thumbs, addBtn, file)), el('td', {}, el('div', { class: 'row' }, rec, play)), el('td', {}, m.trials ? el('span', { class: 'chip ' + (m.mastered ? 'ok' : 'mid') }, m.mastered ? 'ათვისებული' : `${m.independent}/${m.trials} თავად`) : el('span', { class: 'small' }, 'ჯერ არა'))));
  }
  box.appendChild(t);
}
function resizeImage(file, max) {
  return new Promise((res) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => { URL.revokeObjectURL(u); res(b || file); }, 'image/jpeg', 0.85); };
    img.onerror = () => res(file); img.src = u;
  });
}
async function recordAudio(word, btn) {
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('ამ ბრაუზერში ჩაწერა არ არის; ჩაწერე iPad-ის Safari-ში'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = []; const mr = new MediaRecorder(stream);
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); const key = `${word.id}:audio`; await idb.put(key, blob); urlCache.delete(key); word.audioKey = key; save(); btn.textContent = '● ხელახლა'; toast(`„${word.ka}“ ჩაიწერა`); };
    btn.textContent = '■ 2 წმ…'; mr.start(); setTimeout(() => mr.stop(), 2000);
  } catch (e) { toast('მიკროფონზე წვდომა არ არის: ' + e.message); }
}

// ---- library ----
function renderLibrary() {
  const box = $('#tab-library'); box.innerHTML = '';
  box.appendChild(el('div', { class: 'note' }, 'ჯილდო მხოლოდ 3–5 სწორი პასუხის შემდეგ ირთვება. YouTube-ის სიუჟეტს ინტერნეტი სჭირდება; ოფლაინ რეჟიმში ჭიკუ ცეკვავს ან საკუთარი ვიდეო ირთვება. ენერგიულ პერსონაჟს დავაკვირდეთ: თუ სიუჟეტის შემდეგ დავალებას ვეღარ უბრუნდება, დამალე.'));
  const s = store.settings;
  const tog = el('input', { type: 'checkbox' }); tog.checked = !!s.rewardsEnabled; tog.addEventListener('change', () => { s.rewardsEnabled = tog.checked; save(); renderHome(); });
  box.appendChild(el('div', { class: 'box row' }, el('label', { class: 'row', style: 'flex-direction:row; align-items:center; gap:10px' }, tog, 'ჯილდოები ჩართულია (პირველ კვირაში გამორთე, მეორედან ჩართე შედარებისთვის)')));
  const year = aggregate(store.log, 'year');
  for (const c of store.characters) {
    const st = year.perCharacter[c.id] || { chosen: 0, calm: 0, upset: 0 };
    const en = el('input', { type: 'checkbox', 'aria-label': `ჩართე ${c.name}` }); en.checked = c.enabled !== false; en.addEventListener('change', () => { c.enabled = en.checked; save(); });
    const hid = el('input', { type: 'checkbox', 'aria-label': `დამალე ${c.name}` }); hid.checked = !!c.hidden; hid.addEventListener('change', () => { c.hidden = hid.checked; save(); });
    const pace = el('select', {}, ...[['calm', 'მშვიდი'], ['mid', 'ზომიერი'], ['high', 'ენერგიული'], ['unknown', 'შეაფასე']].map(([v, l]) => { const o = el('option', { value: v }, l); if (c.pace === v) o.selected = true; return o; })); pace.style.width = '140px'; pace.addEventListener('change', () => { c.pace = pace.value; save(); });
    const clips = el('div', { class: 'small' });
    (c.clips || []).forEach((cl, i) => clips.appendChild(el('div', { class: 'row', style: 'margin:4px 0' }, el('span', {}, cl.youtubeId ? `YouTube ${cl.youtubeId}` : 'საკუთარი ვიდეო'), el('span', {}, `${cl.start}→${cl.end} წმ (${cl.end - cl.start} წმ)`), el('button', { class: 'tab', onclick: () => { c.clips.splice(i, 1); save(); renderLibrary(); } }, 'წაშლა'))));
    const url = el('input', { type: 'url', placeholder: 'https://www.youtube.com/watch?v=… (ოფიციალური არხი)', 'aria-label': 'ვიდეოს ბმული' });
    const st0 = el('input', { type: 'number', min: 0, value: 0, 'aria-label': 'დასაწყისი, წმ' }); const en0 = el('input', { type: 'number', min: 1, value: 7, 'aria-label': 'დასასრული, წმ' });
    const add = el('button', { class: 'tab', onclick: () => {
      const id = youtubeId(url.value); const a = Number(st0.value), b = Number(en0.value);
      if (!id) { toast('ბმული ვერ გავიგე'); return; } if (!(b > a) || b - a > 15) { toast('სიუჟეტი 1–15 წამი უნდა იყოს'); return; }
      (c.clips = c.clips || []).push({ youtubeId: id, start: a, end: b, enabled: true }); save(); renderLibrary(); toast('სიუჟეტი დაემატა');
    } }, 'დამატება');
    const vid = el('input', { type: 'file', accept: 'video/*', class: 'hidden', 'aria-label': 'საკუთარი ვიდეოს ატვირთვა' });
    vid.addEventListener('change', async () => { const f = vid.files[0]; if (!f) return; const key = `${c.id}:video:${now()}`; await idb.put(key, f); (c.clips = c.clips || []).push({ blobKey: key, start: 0, end: 7, enabled: true }); save(); renderLibrary(); toast('ვიდეო დაემატა'); });
    box.appendChild(el('div', { class: 'box' },
      el('div', { class: 'row between' }, el('div', { class: 'row' }, el('strong', { style: 'font-size:18px' }, c.name), el('span', { class: 'chip ' + c.pace }, { calm: 'მშვიდი', mid: 'ზომიერი', high: 'ენერგიული', unknown: 'შეაფასე' }[c.pace])), el('div', { class: 'small' }, `წელს არჩეული ${st.chosen}-ჯერ · მშვიდად ${st.calm} · გაღიზიანდა ${st.upset}`)),
      el('div', { class: 'row', style: 'margin:8px 0' }, el('label', { class: 'row', style: 'flex-direction:row; align-items:center' }, en, 'ჩართული'), el('label', { class: 'row', style: 'flex-direction:row; align-items:center' }, hid, 'დამალული არჩევის ეკრანიდან'), el('label', {}, 'ტემპი', pace)),
      clips,
      el('div', { class: 'row', style: 'margin-top:8px' }, el('div', { style: 'flex:3; min-width:240px' }, url), el('div', { style: 'width:110px' }, st0), el('div', { style: 'width:110px' }, en0), add, el('button', { class: 'tab', onclick: () => vid.click() }, '+ საკუთარი ვიდეო'), vid)));
  }
  const nm = el('input', { type: 'text', placeholder: 'ახალი პერსონაჟის სახელი' });
  box.appendChild(el('div', { class: 'box row' }, el('div', { style: 'flex:1' }, nm), el('button', { class: 'tab', onclick: () => { const n = nm.value.trim(); if (!n) return; store.characters.push({ id: 'c' + now(), name: n, pace: 'unknown', enabled: true, hidden: false, clips: [] }); save(); renderLibrary(); } }, '+ პერსონაჟი')));
}
export function youtubeId(u) {
  if (!u) return null;
  const m = String(u).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/) || String(u).match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}

// ---- calendar ----
function renderCalendar() {
  const box = $('#tab-calendar'); box.innerHTML = '';
  const p = store.plan;
  const names = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ']; const jsDays = [1, 2, 3, 4, 5, 6, 0];
  const dayBox = el('div', { class: 'choicebtns' }, ...names.map((n, i) => el('button', { type: 'button', class: p.days.includes(jsDays[i]) ? 'on' : '', 'data-day': jsDays[i], onclick: (e) => { const d = jsDays[i]; p.days = p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d]; save(); renderCalendar(); } }, n)));
  const times = el('div', { class: 'row' }, ...p.times.map((t, i) => el('div', { class: 'row' }, el('input', { type: 'time', value: t, 'aria-label': `სესია ${i + 1}`, onchange: e => { p.times[i] = e.target.value; save(); renderCalendar(); } }), el('button', { class: 'tab', onclick: () => { p.times.splice(i, 1); save(); renderCalendar(); } }, '−'))), el('button', { class: 'tab', onclick: () => { p.times.push('15:00'); save(); renderCalendar(); } }, '+ სესია'));
  const dur = el('input', { type: 'number', min: 3, max: 15, value: p.durationMin, onchange: e => { p.durationMin = Number(e.target.value); save(); renderCalendar(); } });
  const brk = el('input', { type: 'number', min: 30, max: 600, step: 30, value: p.breakMin, onchange: e => { p.breakMin = Number(e.target.value); save(); renderCalendar(); } });
  const v = planIsValid(p); const n = nextSession(p);
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'კვირის გეგმა'), el('div', { class: 'kicker' }, 'დღეები'), dayBox, el('div', { class: 'kicker', style: 'margin-top:12px' }, 'სესიების დრო'), times,
    el('div', { class: 'grid2', style: 'margin-top:12px' }, el('label', {}, 'სესიის ხანგრძლივობა, წთ (3–5 საწყისი, 15 მაქსიმუმი)', dur), el('label', {}, 'შესვენება სესიებს შორის, წთ', brk)),
    el('div', { class: 'row', style: 'margin-top:12px' }, el('span', { class: 'chip ' + (v.ok ? 'ok' : 'warn'), id: 'plan-status' }, v.ok ? 'გეგმა სწორია' : v.reason), el('span', { class: 'small', id: 'plan-next' }, n ? `შემდეგი სესია: ${new Date(n.at).toLocaleString('ka-GE')}` : ''))));
  const notifBtn = el('button', { class: 'tab', onclick: async () => { if (!('Notification' in window)) { toast('ამ ბრაუზერში შეტყობინებები არ არის'); return; } const r = await Notification.requestPermission(); toast(r === 'granted' ? 'შეტყობინებები ჩართულია (აპი ღია უნდა იყოს)' : 'შეტყობინებები არ არის დაშვებული'); } }, 'შეტყობინებების ჩართვა');
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'შეხსენებები'),
    el('div', {}, 'ვებ-ვერსიაში შეხსენება მხოლოდ ღია აპიდან მოდის. სანდო გზა iPad-ზე: გეგმის ჩაწერა კალენდარში, 10 წუთით ადრე შეხსენებით. აპის მაღაზიის ვერსიაში (Flutter) ადგილობრივი push-შეტყობინებები იქნება.'),
    el('div', { class: 'row', style: 'margin-top:10px' }, el('button', { class: 'tab', onclick: () => download('sitkva-plan.ics', toICS(p, (store.profile || {}).name || 'ბავშვი'), 'text/calendar') }, 'კალენდარში დამატება (.ics)'), notifBtn,
      el('button', { class: 'tab', onclick: () => { logEvent({ type: 'reminder_test', t: now() }); notify('Sitkva', 'სატესტო შეხსენება: სესია 10 წუთში'); } }, 'სატესტო შეხსენება'))));
}
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body }); return; } catch (e) { /* fall through */ } }
  toast(`${title}: ${body}`);
}
function scheduleInAppReminders() {
  const check = () => {
    const n = nextSession(store.plan); if (!n) return;
    const dt = n.at - now();
    if (dt > 0 && dt <= 10 * 60000 && store._lastReminded !== n.at) { store._lastReminded = n.at; notify('Sitkva', `${(store.profile || {}).name || 'ბავშვის'} სესია 10 წუთში: ${new Date(n.at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })}`); }
  };
  check(); setInterval(check, 60000);
}

// ---- questions ----
function renderQuestions() {
  const box = $('#tab-questions'); box.innerHTML = '';
  box.appendChild(el('div', { class: 'note' }, 'საღამოს სამი კითხვა, თითო ერთი შეხებით. პასუხები მასალასა და გეგმას ცვლის: გადატანა, ინტერესი, ჯილდო, ხმა, დრო.'));
  const qs = pickQuestions(store.log);
  for (const q of qs) {
    const row = el('div', { class: 'choicebtns' });
    for (const o of q.options) row.appendChild(el('button', { type: 'button', 'data-q': q.id, onclick: (e) => { logEvent({ type: 'answer', questionId: q.id, answer: o, effect: q.effect, t: now() }); $$('button', row).forEach(b => b.classList.toggle('on', b === e.currentTarget)); toast('ჩაიწერა'); } }, o));
    box.appendChild(el('div', { class: 'box' }, el('div', { style: 'font-weight:700; margin-bottom:8px' }, q.text), row));
  }
  const answers = store.log.filter(e => e.type === 'answer').slice(-10).reverse();
  if (answers.length) box.appendChild(el('div', { class: 'box' }, el('h3', {}, 'ბოლო პასუხები'), ...answers.map(a => el('div', { class: 'small' }, `${new Date(a.t).toLocaleDateString('ka-GE')} · ${(QUESTIONS.find(q => q.id === a.questionId) || { text: a.questionId }).text} → ${a.answer}`))));
}

// ---- suggestions ----
function renderSuggestions() {
  const box = $('#tab-suggestions'); box.innerHTML = '';
  box.appendChild(el('div', { class: 'note' }, 'აპი სთავაზობს, მშობელი წყვეტს. სიტყვის შეცვლა ლოგოპედთან თანხმდება. უარყოფილი შეთავაზება არ განმეორდება.'));
  const dismissed = new Set(store.log.filter(e => e.type === 'suggestion_decision' && !e.accepted).map(e => e.key));
  const list = suggestions(store.log, store.words, store.characters).filter(s => !dismissed.has(sKey(s)));
  if (!list.length) box.appendChild(el('div', { class: 'box small' }, 'ახლა შეთავაზება არ არის. წესები: ფოტო 10-დან 7-ჯერ უყურადღებოდ; სიტყვა 20 ცდის შემდეგ < 40% თავად; პასუხის დრო +40% ორ კვირაში; 8/10 ათვისება; სიუჟეტის ბოლოს ორჯერ გაღიზიანება; პერსონაჟი ორ კვირაში არცერთხელ.'));
  for (const s of list) {
    box.appendChild(el('div', { class: 'box' }, el('div', { style: 'font-weight:700' }, s.text), el('div', { class: 'row', style: 'margin-top:10px' },
      el('button', { class: 'btn', style: 'font-size:16px; padding:12px 18px', onclick: () => { applySuggestion(s); logEvent({ type: 'suggestion_decision', key: sKey(s), kind: s.kind, accepted: true, t: now() }); renderSuggestions(); } }, 'შევცვალოთ'),
      el('button', { class: 'btn secondary', style: 'font-size:16px; padding:12px 18px', onclick: () => { logEvent({ type: 'suggestion_decision', key: sKey(s), kind: s.kind, accepted: false, t: now() }); renderSuggestions(); } }, 'დავტოვოთ'))));
  }
}
const sKey = suggestionKey;
function applySuggestion(s) {
  const w = s.wordId ? wordById(s.wordId) : null; const c = s.characterId ? charById(s.characterId) : null;
  if (s.action === 'replace_photo' && w && w.photos && w.photos[s.photoIndex]) { w.photos[s.photoIndex].off = true; toast('ფოტო გამორთულია, დაამატე ახალი'); }
  else if (s.action === 'simplify' && w) { w.paused = true; w.enabled = false; toast(`„${w.ka}“ დაპარკდა; ლოგოპედთან შეთანხმების შემდეგ ჩართე`); }
  else if (s.action === 'more_hint' && w) { store.settings.choiceWaitMs = Math.max(2000, store.settings.choiceWaitMs - 500); toast('ლოდინი შემცირდა, მინიშნება უფრო ადრე მოვა'); }
  else if (s.action === 'level_up' && w) { w.level = Math.min(3, (w.level || 0) + 1); toast(`„${w.ka}“ დონე ${w.level}`); }
  else if (s.action === 'hide_character' && c) { c.hidden = true; toast(`${c.name} დამალულია`); }
  else if (s.action === 'remove_character' && c) { c.enabled = false; toast(`${c.name} გამორთულია`); }
  else if (s.action === 'add_word') { toast('დაამატე სიტყვა ლოგოპედთან შეთანხმებით'); }
  save();
}

// ---- settings ----
const LANG_KA = { ka: 'ქართული', ru: 'რუსული', en: 'ინგლისური' };
function renderSettings() {
  const box = $('#tab-settings'); box.innerHTML = '';
  const s = store.settings, p = store.profile || {};
  const num = (label, key, min, max, step, scale = 1) => { const i = el('input', { type: 'number', min, max, step, value: s[key] / scale }); i.addEventListener('change', () => { s[key] = Number(i.value) * scale; save(); }); return el('label', {}, label, i); };
  const motion = el('input', { type: 'checkbox' }); motion.checked = s.motion !== false; motion.addEventListener('change', () => { s.motion = motion.checked; document.body.classList.toggle('no-motion', !s.motion); save(); });
  const pin = el('input', { type: 'text', inputmode: 'numeric', maxlength: 4, value: s.pin }); pin.addEventListener('change', () => { if (/^[0-9]{4}$/.test(pin.value)) { s.pin = pin.value; save(); toast('PIN შეიცვალა'); } else toast('PIN 4 ციფრი'); });
  const name = el('input', { type: 'text', value: p.name || '' }); name.addEventListener('change', () => { store.profile.name = name.value.trim(); save(); });
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'პროფილი'), el('div', { class: 'grid3' }, el('label', {}, 'სახელი', name), el('label', {}, 'ასაკი', el('input', { type: 'text', readonly: true, value: ageText(p.birth) || '—' })), el('label', {}, 'ენები', el('input', { type: 'text', readonly: true, value: `${LANG_KA[p.lang || 'ka'] || p.lang}${p.lang2 && p.lang2 !== 'none' ? ' + ' + (LANG_KA[p.lang2] || p.lang2) : ''}` })))));
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'სესიის წესები'), el('div', { class: 'grid3' },
    num('ლოდინი არჩევამდე, წმ', 'choiceWaitMs', 1, 10, 0.5, 1000), num('ლოდინი ხმოვან მცდელობაზე, წმ', 'vocalWaitMs', 1, 10, 0.5, 1000), num('უკუკავშირი, წმ', 'feedbackMs', 0.5, 3, 0.5, 1000),
    num('ცდა სესიაში', 'trialsPerSession', 3, 12, 1), num('სესიის მაქსიმუმი, წთ', 'sessionMaxMs', 3, 15, 1, 60000), num('ჯილდო N სწორის შემდეგ', 'rewardAfterCorrect', 2, 6, 1),
    num('ნამდვილი საგანი ყოველ N ცდაში', 'realObjectEvery', 1, 5, 1), num('აქტიური სიტყვები ერთდროულად', 'activeWords', 1, 6, 1), el('label', { class: 'row', style: 'flex-direction:row; align-items:center; margin-top:24px' }, motion, 'ანიმაცია (ჭიკუ, ღრუბლები)')),
    el('div', { class: 'small', style: 'margin-top:8px' }, 'საწყისი მნიშვნელობები Perplexity-სა და ChatGPT-ის რჩევებიდანაა: 3 წმ არჩევა, 5 წმ ხმა, 5 ცდა, 5 წუთი.')));
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'უსაფრთხოება და მონაცემები'), el('div', { class: 'grid3' }, el('label', {}, 'მშობლის PIN', pin)),
    el('div', { class: 'row', style: 'margin-top:12px' },
      el('button', { class: 'tab', onclick: () => download('sitkva-backup.json', JSON.stringify(store), 'application/json') }, 'სარეზერვო ასლი'),
      el('button', { class: 'tab', onclick: () => { loadDemo(); toast('სადემონსტრაციო მონაცემები ჩაიტვირთა'); } }, 'სადემონსტრაციო მონაცემები (20 დღე)'),
      el('button', { class: 'tab danger', onclick: () => { if (confirm('წავშალოთ ყველა ჩანაწერი? ფოტოები და ხმა რჩება.')) { store.log = []; save(); toast('ჩანაწერები წაიშალა'); renderSettings(); } } }, 'ჩანაწერების წაშლა'),
      el('button', { class: 'tab danger', onclick: () => { if (confirm('სრული გადატვირთვა: პროფილი, სიტყვები, ჩანაწერები?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'სრული გადატვირთვა')),
    el('div', { class: 'small', style: 'margin-top:8px' }, 'მონაცემები მხოლოდ ამ მოწყობილობაზეა. სერვერი, ანალიტიკა და რეკლამა არ არის.')));
  renderCredits(box);
}
function renderCredits(box) {
  const list = el('div', { class: 'small' }, 'იტვირთება…');
  box.appendChild(el('div', { class: 'box' }, el('h2', { style: 'margin-top:0' }, 'საწყისი ფოტოების ავტორები'),
    el('div', { class: 'small', style: 'margin-bottom:8px' }, 'Wikimedia Commons, ღია ლიცენზიები. ნებისმიერი ფოტო შეგიძლია შეცვალო ან წაშალო „სიტყვები“ ტაბში.'), list));
  loadSeedManifest().then(items => {
    list.innerHTML = '';
    for (const it of items) list.appendChild(el('div', {}, `${(wordById(it.wordId) || { ka: it.wordId }).ka}: ${it.author} · ${it.license} · `, el('a', { href: it.source, target: '_blank', rel: 'noopener' }, 'წყარო')));
  });
}
function loadDemo() {
  const t0 = now(); const day = 86400000; const rng = makeRng(5);
  const ids = ['deda', 'mama', 'bebo', 'bai', 'ara', 'mome'];
  for (let d = 19; d >= 0; d--) {
    for (let k = 0; k < (rng() < 0.7 ? 2 : 1); k++) {
      const start = t0 - d * day - (k ? 6 : 1) * 3600000 - Math.floor(rng() * 1800000);
      const sid = 'demo' + d + k; const ch = ['bluey', 'peppa', 'daniel', 'paw'][Math.floor(rng() * 4)];
      let correct = 0;
      for (let i = 0; i < 5; i++) {
        const wordId = ids[Math.min(ids.length - 1, Math.floor(i / 2) + Math.floor((19 - d) / 7))];
        const skill = Math.min(0.9, 0.35 + (19 - d) * 0.03);
        const r = rng(); const response = r < skill ? 'independent' : r < skill + 0.25 ? 'prompted' : 'none';
        if (response !== 'none') correct++;
        store.log.push({ type: 'trial', sessionId: sid, t: start + i * 25000, wordId, photoIndex: i % 3, response, latencyMs: response === 'none' ? null : Math.round(2600 - (19 - d) * 60 + rng() * 600), taps: response === 'none' ? 0 : 1, wrongTaps: 0, hinted: response === 'prompted', realObject: i % 2 ? (rng() < 0.5 ? 'tried' : 'not_yet') : undefined });
      }
      store.log.push({ type: 'session', id: sid, startedAt: start, durationMs: Math.round((3 + rng() * 2) * 60000), completed: true, refusals: rng() < 0.1 ? 1 : 0, characterId: d > 12 ? null : ch, trialsPlanned: 5, trialsDone: 5, correct, rewardsShown: d > 12 ? 0 : 1, calmAfterReward: d > 12 ? null : (ch === 'paw' ? rng() < 0.4 : rng() < 0.9), distress: false });
    }
  }
  store.log.sort((a, b) => (a.t || a.startedAt) - (b.t || b.startedAt)); save();
}

// ---------------------------------------------------------------- seed photos
// Openly licensed starter photos (app/seed-photos, credits in CREDITS.md). Added once per store;
// the parent can switch off, delete or replace any of them, and they are never re-added.
const SEED_PHOTOS_VERSION = 2; // v2: photos of other people's children removed (ამ-ამ, ნანა)
let seedManifest = null;
async function loadSeedManifest() {
  if (seedManifest) return seedManifest;
  try { seedManifest = await (await fetch('seed-photos/manifest.json')).json(); } catch (e) { seedManifest = []; }
  return seedManifest;
}
async function applySeedPhotos() {
  if (TEST || (store.seedPhotos || 0) >= SEED_PHOTOS_VERSION) return false;
  const items = await loadSeedManifest();
  if (!items.length) return false; // offline on the very first start: try again next time
  // drop seed photos that are no longer shipped; the parent's own photos are never touched
  const keep = new Set(items.map(it => it.key));
  for (const w of store.words) if (w.photos) w.photos = w.photos.filter(p => !p.seed || keep.has(p.key));
  const firstTime = !store.seedPhotos;
  for (const it of items) {
    if (!firstTime) break; // later versions only remove; never re-add photos the parent deleted
    const w = wordById(it.wordId); if (!w) continue;
    w.photos = w.photos || [];
    if (!w.photos.some(p => p.key === it.key)) w.photos.push({ key: it.key, src: `seed-photos/${it.file}`, seed: true });
  }
  store.seedPhotos = SEED_PHOTOS_VERSION; save();
  return true;
}

// ---------------------------------------------------------------- boot
function boot() {
  document.body.classList.toggle('no-motion', store.settings.motion === false);
  wireLocks(); wireOnboarding(); wireParent();
  if (!store.profile) show('s-onboarding'); else { renderHome(); show('s-home'); }
  applySeedPhotos().then(added => { if (added && store.profile && !state.session) renderHome(); });
  scheduleInAppReminders();
  if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => {});
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  window.__sitkva = { store, state, dispatch, startSession, abortSession, save, selectTab, openParent, show, loadDemo, logic: { aggregate, suggestions, nextSession, youtubeId } };
}
boot();
