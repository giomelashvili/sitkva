// Sitkva — pure logic (no DOM). Used by the app and by the unit tests.
// All times are milliseconds unless the name says otherwise.

export const SEED_WORDS = [
  { id: 'deda', ka: 'დედა', group: 'ადამიანები', ease: 'easy', order: 1 },
  { id: 'mama', ka: 'მამა', group: 'ადამიანები', ease: 'easy', order: 2 },
  { id: 'bebo', ka: 'ბებო', group: 'ადამიანები', ease: 'easy', order: 3 },
  { id: 'bai', ka: 'ბაი-ბაი', group: 'რუტინა', ease: 'easy', order: 4 },
  { id: 'ara', ka: 'არა', group: 'რუტინა', ease: 'easy', order: 5 },
  { id: 'vai', ka: 'ვაი', group: 'რუტინა', ease: 'easy', order: 6 },
  { id: 'mome', ka: 'მომე', group: 'მოთხოვნა', ease: 'easy', order: 7 },
  { id: 'kidev', ka: 'კიდევ', group: 'მოთხოვნა', ease: 'mid', order: 8 },
  { id: 'gakhseni', ka: 'გახსენი', group: 'მოთხოვნა', ease: 'hard', order: 9 },
  { id: 'zevit', ka: 'ზევით', group: 'მოთხოვნა', ease: 'mid', order: 10 },
  { id: 'morcha', ka: 'მორჩა', group: 'რუტინა', ease: 'hard', order: 11 },
  { id: 'tsqali', ka: 'წყალი', group: 'საჭმელი', ease: 'hard', order: 12 },
  { id: 'amam', ka: 'ამ-ამ', group: 'საჭმელი', ease: 'easy', order: 13 },
  { id: 'puri', ka: 'პური', group: 'საჭმელი', ease: 'mid', order: 14 },
  { id: 'burti', ka: 'ბურთი', group: 'სათამაშო', ease: 'mid', order: 15 },
  { id: 'manqana', ka: 'მანქანა', group: 'სათამაშო', ease: 'mid', order: 16 },
  { id: 'tsigni', ka: 'წიგნი', group: 'სათამაშო', ease: 'mid', order: 17 },
  { id: 'dzaghli', ka: 'ძაღლი', group: 'ცხოველი', ease: 'mid', order: 18 },
  { id: 'kata', ka: 'კატა', group: 'ცხოველი', ease: 'mid', order: 19 },
  { id: 'nana', ka: 'ნანა', group: 'რუტინა', ease: 'easy', order: 20 },
  { id: 'abano', ka: 'აბანო', group: 'რუტინა', ease: 'mid', order: 21 },
  { id: 'pekhsatsmeli', ka: 'ფეხსაცმელი', group: 'საგნები', ease: 'hard', order: 22 },
  { id: 'tvali', ka: 'თვალი', group: 'სხეული', ease: 'mid', order: 23 },
  { id: 'tskheli', ka: 'ცხელი', group: 'თვისება', ease: 'mid', order: 24 },
  { id: 'didi', ka: 'დიდი', group: 'თვისება', ease: 'easy', order: 25 },
  { id: 'patara', ka: 'პატარა', group: 'თვისება', ease: 'mid', order: 26 }
];

export const SEED_CHARACTERS = [
  { id: 'bluey', name: 'Bluey', pace: 'mid' },
  { id: 'peppa', name: 'Peppa Pig', pace: 'mid' },
  { id: 'mickey', name: 'Mickey Mouse', pace: 'unknown' },
  { id: 'msrachel', name: 'Ms Rachel', pace: 'calm' },
  { id: 'daniel', name: 'Daniel Tiger', pace: 'calm' },
  { id: 'pooh', name: 'Winnie the Pooh', pace: 'calm' },
  { id: 'puffin', name: 'Puffin Rock', pace: 'calm' },
  { id: 'paw', name: 'PAW Patrol', pace: 'high' },
  { id: 'sss', name: 'Super Simple Songs', pace: 'unknown' },
  { id: 'masha', name: 'Маша и Медведь', pace: 'unknown' }
];

export const DEFAULT_SETTINGS = {
  choiceWaitMs: 3000,
  vocalWaitMs: 5000,
  feedbackMs: 1500,
  trialsPerSession: 5,
  sessionMaxMs: 5 * 60 * 1000,
  choices: 2,
  rewardAfterCorrect: 3,      // big reward after N correct answers
  realObjectEvery: 2,         // real-object pause after every N trials
  activeWords: 2,             // week 1: two words, chosen by the parent with the therapist (decided 2026-10-19)
  knownShare: 0.75,           // share of trials on already-mastered words
  rewardsEnabled: false,      // week 1 of the test runs with rewards off; the parent switches them on (decided 2026-10-19)
  motion: true,
  pin: '1234',
  language: 'ka'
};

export const DEFAULT_PLAN = {
  days: [1, 2, 3, 4, 5, 6, 0],   // JS getDay(): 0 = Sunday
  times: ['10:00', '17:30'],
  durationMin: 5,
  breakMin: 120,
  taskTime: '13:00',
  questionsTime: '20:30'
};

// --- deterministic rng (mulberry32) so tests can replay a session ---
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- helpers ---------------------------------------------------------------
// "Last N" always means latest by time, never array position (the log may arrive in any order).
function byTime(xs) {
  return xs.map((x, i) => [x, i]).sort((a, b) => ((a[0].t ?? 0) - (b[0].t ?? 0)) || (a[1] - b[1])).map(p => p[0]);
}

// Stable photo identity: stored key/id, never the array index (indexes shift when a photo is removed).
export function photoIdOf(photo, index) {
  return (photo && (photo.key || photo.id)) || `#${index}`;
}

// Photos that may be shown: present and not switched off. Keeps the index into word.photos.
export function activePhotos(word) {
  return (word.photos || []).map((p, i) => ({ p, i })).filter(x => x.p && !x.p.off);
}

// Words a session may use (as target or distractor): enabled, not parked, suitable for a photo task,
// and — unless settings.requirePhotos is false — with at least one active photo.
export function usableWords(words, settings = DEFAULT_SETTINGS) {
  const needPhoto = settings.requirePhotos !== false;
  return words
    .filter(w => w.enabled !== false && !w.paused && w.photoTask !== false)
    .filter(w => !needPhoto || activePhotos(w).length > 0)
    .sort((a, b) => a.order - b.order);
}

// --- mastery ---------------------------------------------------------------
// A word is "mastered" when its last 10 trials (by time) have >= 8 independent correct.
// `since` ignores trials before a moment (e.g. the last accepted level-up).
export function masteryOf(wordId, log, since = -Infinity) {
  const trials = byTime(log.filter(t => t.wordId === wordId && (t.t ?? 0) >= since && (t.type ?? 'trial') === 'trial')).slice(-10);
  const indep = trials.filter(t => t.response === 'independent').length;
  return { trials: trials.length, independent: indep, mastered: trials.length >= 10 && indep >= 8 };
}

// --- session planning ------------------------------------------------------
function pickPhoto(word, rng) {
  const ps = activePhotos(word);
  if (!ps.length) return { photoIndex: 0, photoId: null };
  const { p, i } = ps[Math.floor(rng() * ps.length)];
  return { photoIndex: i, photoId: photoIdOf(p, i) };
}

export function planSession(words, log, settings = DEFAULT_SETTINGS, rng = Math.random) {
  const enabled = usableWords(words, settings);
  if (enabled.length < 2) throw new Error('need at least 2 usable words');
  const mastered = enabled.filter(w => masteryOf(w.id, log).mastered);
  const learning = enabled.filter(w => !masteryOf(w.id, log).mastered);
  const active = learning.slice(0, settings.activeWords);
  const n = settings.trialsPerSession;
  const trials = [];
  for (let i = 0; i < n; i++) {
    const useKnown = mastered.length > 0 && rng() < settings.knownShare && active.length > 0 ? true : mastered.length > 0 && active.length === 0;
    const pool = useKnown ? mastered : (active.length ? active : enabled);
    const target = pool[Math.floor(rng() * pool.length)];
    const others = enabled.filter(w => w.id !== target.id);
    const distractor = others[Math.floor(rng() * others.length)];
    const targetSide = rng() < 0.5 ? 0 : 1;
    const { photoIndex, photoId } = pickPhoto(target, rng);
    const d = pickPhoto(distractor, rng);
    trials.push({ index: i, wordId: target.id, distractorId: distractor.id, targetSide, photoIndex, photoId,
      distractorPhotoIndex: d.photoIndex, distractorPhotoId: d.photoId });
  }
  // no three identical sides in a row (position bias guard)
  for (let i = 2; i < trials.length; i++) {
    if (trials[i].targetSide === trials[i - 1].targetSide && trials[i].targetSide === trials[i - 2].targetSide) {
      trials[i].targetSide = 1 - trials[i].targetSide;
    }
  }
  return { trials, startedAt: null, activeWordIds: active.map(w => w.id) };
}

// --- trial state machine ---------------------------------------------------
// states: listen -> wait -> (hint ->) feedback -> done
export function initialTrialState(trial, now = 0) {
  return {
    phase: 'listen', trial, audioEndedAt: null, firstTapAt: null, taps: 0, wrongTaps: 0,
    hinted: false, response: null, latencyMs: null, startedAt: now
  };
}

export function trialReducer(state, event) {
  const s = { ...state };
  switch (event.type) {
    case 'AUDIO_END':
      if (s.phase !== 'listen') return s;
      s.phase = 'wait';
      s.audioEndedAt = event.t;
      return s;
    case 'TIMEOUT':
      if (s.phase !== 'wait') return s;
      s.phase = 'hint';
      s.hinted = true;
      return s;
    case 'TAP': {
      if (s.phase !== 'wait' && s.phase !== 'hint') return s; // taps locked while audio plays
      s.taps += 1;
      if (s.firstTapAt == null) s.firstTapAt = event.t;
      if (event.side === s.trial.targetSide) {
        s.phase = 'feedback';
        // Raw time from audio end; statistics use it only for independent answers (see latencyOf).
        s.latencyMs = Math.max(0, event.t - (s.audioEndedAt ?? event.t));
        if (s.wrongTaps > 0) s.response = 'trial_and_error'; // tapped the other photo first, then found it
        else if (s.hinted) s.response = 'prompted';          // needed the hint after the wait
        else s.response = 'independent';
        return s;
      }
      // wrong side: errorless — no negative signal, go to hint
      s.wrongTaps += 1;
      if (s.phase === 'wait') { s.phase = 'hint'; s.hinted = true; }
      return s;
    }
    case 'FEEDBACK_END':
      if (s.phase !== 'feedback') return s;
      s.phase = 'done';
      return s;
    case 'ABORT':
      s.phase = 'done';
      if (!s.response) s.response = 'none';
      return s;
    default:
      return s;
  }
}

export function shouldPauseForRealObject(trialIndex, settings = DEFAULT_SETTINGS) {
  return (trialIndex + 1) % settings.realObjectEvery === 0;
}

export function shouldReward(correctSinceReward, settings = DEFAULT_SETTINGS) {
  return settings.rewardsEnabled && correctSinceReward >= settings.rewardAfterCorrect;
}

// --- reward character choice: 2 most chosen recently + 1 rotating --------------
export function chooseCharacterCards(characters, log, rotation = 0) {
  const enabled = characters.filter(c => c.enabled !== false && !c.hidden);
  if (enabled.length <= 3) return enabled;
  const counts = {};
  for (const s of log.filter(e => e.type === 'session' && e.characterId)) counts[s.characterId] = (counts[s.characterId] || 0) + 1;
  const byCount = enabled.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  const top = byCount.slice(0, 2);
  const rest = enabled.filter(c => !top.includes(c));
  const third = rest[rotation % rest.length];
  return [...top, third];
}

// --- statistics ------------------------------------------------------------
export function periodRange(period, now = Date.now()) {
  const d = new Date(now);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') { const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
  if (period === 'month') start.setDate(1);
  if (period === 'year') { start.setMonth(0, 1); }
  return { from: start.getTime(), to: now };
}

export function aggregate(log, period = 'week', now = Date.now()) {
  const { from, to } = periodRange(period, now);
  const sessions = log.filter(e => e.type === 'session' && e.startedAt >= from && e.startedAt <= to);
  const trials = log.filter(e => e.type === 'trial' && e.t >= from && e.t <= to);
  const answered = trials.filter(t => t.response && t.response !== 'none');
  const independent = answered.filter(t => t.response === 'independent');
  const minutes = sessions.reduce((a, s) => a + (s.durationMs || 0), 0) / 60000;
  const perWord = {};
  for (const t of trials) {
    const w = perWord[t.wordId] || (perWord[t.wordId] = { wordId: t.wordId, trials: 0, independent: 0, prompted: 0, trialAndError: 0, none: 0, latencies: [] });
    w.trials += 1;
    if (t.response === 'independent') w.independent += 1;
    else if (t.response === 'prompted' || t.response === 'trial_and_error') w.prompted += 1;
    else w.none += 1;
    if (t.response === 'trial_and_error') w.trialAndError += 1;
    const lat = latencyOf(t); if (lat != null) w.latencies.push(lat);
  }
  for (const w of Object.values(perWord)) {
    w.independentPct = w.trials ? Math.round(100 * w.independent / w.trials) : 0;
    w.medianLatencyMs = median(w.latencies);
  }
  const perDay = {};
  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    perDay[k] = (perDay[k] || 0) + (s.durationMs || 0) / 60000;
  }
  const heat = {}; // "day-hour" -> independent share
  for (const t of answered) {
    const d = new Date(t.t);
    const k = `${(d.getDay() + 6) % 7}-${d.getHours()}`;
    const h = heat[k] || (heat[k] = { n: 0, indep: 0 });
    h.n += 1; if (t.response === 'independent') h.indep += 1;
  }
  const perCharacter = {};
  for (const s of sessions) if (s.characterId) {
    const c = perCharacter[s.characterId] || (perCharacter[s.characterId] = { chosen: 0, calm: 0, upset: 0 });
    c.chosen += 1; if (s.calmAfterReward === true) c.calm += 1; if (s.calmAfterReward === false) c.upset += 1;
  }
  return {
    period, from, to,
    sessions: sessions.length,
    completed: sessions.filter(s => s.completed).length,
    minutes: Math.round(minutes * 10) / 10,
    trials: trials.length,
    independentPct: independentPct(trials) ?? 0,
    refusals: sessions.reduce((a, s) => a + (s.refusals || 0), 0),
    realObjectTried: trials.filter(t => t.realObject === 'tried').length,
    realObjectAsked: trials.filter(t => t.realObject).length,
    perWord, perDay, heat, perCharacter
  };
}

export function wordTrend(wordId, log, now = Date.now()) {
  // latency and independent share per ISO week for the last 8 weeks
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - i * 7);
    const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    const ts = log.filter(e => e.type === 'trial' && e.wordId === wordId && e.t >= start.getTime() && e.t <= end.getTime());
    const answered = ts.filter(t => t.response && t.response !== 'none');
    weeks.push({
      weekStart: start.getTime(),
      trials: ts.length,
      independentPct: independentPct(ts),
      medianLatencyMs: median(ts.map(latencyOf).filter(x => x != null))
    });
  }
  return weeks;
}

// Share of trials answered independently; unanswered trials count as not independent
// (same definition as mastery and the word table). null when there are no trials.
export function independentPct(trials) {
  if (!trials.length) return null;
  return Math.round(100 * trials.filter(t => t.response === 'independent').length / trials.length);
}

// Response time used in statistics: only independent answers. Prompted / trial-and-error times
// include the wait and the hint, so they would make a child who gets more help look "slower".
export function latencyOf(t) {
  return t.response === 'independent' && t.latencyMs != null ? t.latencyMs : null;
}

export function median(xs) {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- adaptation rules (the app proposes, the parent decides) -----------------
// Key under which a parent's decision on a suggestion is remembered (photoId, not index).
export function suggestionKey(sg) {
  return `${sg.kind}:${sg.wordId || sg.characterId || sg.itemId || ''}:${sg.photoId ?? ''}`;
}

// Items in free-play logs that are not pictures of things (the mascot), so never "add as a word".
const NOT_A_WORD = new Set(['chiku']);

export function suggestions(log, words, characters, now = Date.now()) {
  const out = [];
  const trials = byTime(log.filter(e => e.type === 'trial'));
  const decisions = log.filter(e => e.type === 'suggestion_decision');
  const twoWeeksAgo = now - 14 * 86400000;
  for (const w of words.filter(w => w.enabled !== false)) {
    const ts = trials.filter(t => t.wordId === w.id);
    // photo not chosen on its own: last 10 trials where that photo was the target, >= 7 not independent
    const photos = w.photos || [];
    const byPhoto = {};
    for (const t of ts.slice(-40)) {
      const id = t.photoId ?? photoIdOf(photos[t.photoIndex ?? 0], t.photoIndex ?? 0);
      (byPhoto[id] || (byPhoto[id] = [])).push(t);
    }
    for (const [photoId, pts] of Object.entries(byPhoto)) {
      const photoIndex = photos.findIndex((p, i) => photoIdOf(p, i) === photoId);
      if (photoIndex >= 0 && photos[photoIndex].off) continue; // already switched off
      const last = pts.slice(-10);
      const notIndep = last.filter(t => t.response !== 'independent').length;
      if (last.length >= 10 && notIndep >= 7) {
        const n = photoIndex >= 0 ? photoIndex + 1 : '';
        out.push({ kind: 'photo', wordId: w.id, photoId, photoIndex: photoIndex >= 0 ? photoIndex : null, text: `„${w.ka}“: ფოტო ${n} ბოლო 10 ცდიდან ${notIndep}-ჯერ თავად არ აირჩია. შევცვალოთ იმავე სიტყვის სხვა ფოტოთი?`, action: 'replace_photo' });
      }
    }
    // word too hard: after 20 trials independent < 40%
    if (ts.length >= 20) {
      const last20 = ts.slice(-20);
      const indep = last20.filter(t => t.response === 'independent').length;
      if (indep / 20 < 0.4) {
        out.push({ kind: 'word_hard', wordId: w.id, text: `„${w.ka}“ ურთულდება: ბოლო 20 ცდიდან თავად მხოლოდ ${indep}. შევამციროთ ერთ სამიზნემდე ან დავაპარკოთ ლოგოპედთან შეთანხმებით?`, action: 'simplify' });
      }
    }
    // response time rising over two weeks (independent answers only)
    const recent = ts.filter(t => t.t >= twoWeeksAgo && latencyOf(t) != null);
    const older = ts.filter(t => t.t < twoWeeksAgo && t.t >= twoWeeksAgo - 14 * 86400000 && latencyOf(t) != null);
    if (recent.length >= 8 && older.length >= 8) {
      const r = median(recent.map(latencyOf)), o = median(older.map(latencyOf));
      if (r > o * 1.4) out.push({ kind: 'slower', wordId: w.id, text: `„${w.ka}“: პასუხის დრო ორ კვირაში ${o} მწ-დან ${r} მწ-მდე გაიზარდა. გავაძლიეროთ მინიშნება?`, action: 'more_hint' });
    }
    // mastered: level up / real object. Only trials after the last accepted level-up count,
    // otherwise the same 10 trials would push the word to level 3 in a few taps.
    const lastUp = decisions.filter(d => d.accepted && d.key === suggestionKey({ kind: 'mastered', wordId: w.id }))
      .reduce((m, d) => Math.max(m, d.t ?? 0), -Infinity);
    const m = masteryOf(w.id, trials, lastUp === -Infinity ? -Infinity : lastUp + 1);
    if (m.mastered && (w.level || 0) < 3) {
      out.push({ kind: 'mastered', wordId: w.id, text: `„${w.ka}“ ბოლო 10-დან ${m.independent} თავად. გადავიყვანოთ შემდეგ დონეზე და ნამდვილ საგანზე?`, action: 'level_up' });
    }
  }
  // free play interest -> propose adding as a word
  const touches = {};
  for (const e of log.filter(e => e.type === 'freeplay' && !NOT_A_WORD.has(e.itemId))) touches[e.itemId] = (touches[e.itemId] || 0) + 1;
  const topItem = Object.entries(touches).sort((a, b) => b[1] - a[1])[0];
  if (topItem && topItem[1] >= 15 && !words.find(w => w.id === topItem[0] || w.ka === topItem[0])) {
    out.push({ kind: 'interest', itemId: topItem[0], text: `თავისუფალ თამაშში ყველაზე ხშირად (${topItem[1]}-ჯერ) „${topItem[0]}“ სურათს ეხება. დავამატოთ სიტყვად?`, action: 'add_word' });
  }
  // characters: upsetting or ignored
  const sessions = log.filter(e => e.type === 'session').sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const twoWeeks = sessions.filter(s => s.startedAt >= twoWeeksAgo);
  for (const c of characters.filter(c => c.enabled !== false)) {
    const cs = sessions.filter(s => s.characterId === c.id);
    const lastTwo = cs.slice(-2);
    if (lastTwo.length === 2 && lastTwo.every(s => s.calmAfterReward === false)) {
      out.push({ kind: 'character_upset', characterId: c.id, text: `${c.name}: ბოლო ორ სესიაზე სიუჟეტის დასრულებისას ძლიერი გაღიზიანება. დავმალოთ არჩევის ეკრანიდან?`, action: 'hide_character' });
    }
    // ignored: only fair if the card was actually on the choice screen (>= 3 times) and never picked.
    const shown = twoWeeks.filter(s => (s.shownCharacterIds || []).includes(c.id)).length;
    if (twoWeeks.length >= 10 && shown >= 3 && !twoWeeks.some(s => s.characterId === c.id) && !c.hidden) {
      out.push({ kind: 'character_ignored', characterId: c.id, text: `${c.name} ორ კვირაში ${shown}-ჯერ იყო არჩევანში და არცერთხელ არ აურჩევია. ამოვიღოთ ბიბლიოთეკიდან?`, action: 'remove_character' });
    }
  }
  return out;
}

// --- calendar --------------------------------------------------------------
export function nextSession(plan = DEFAULT_PLAN, now = Date.now()) {
  const base = new Date(now);
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const d = new Date(base); d.setDate(base.getDate() + dayOffset);
    if (!plan.days.includes(d.getDay())) continue;
    for (const time of plan.times.slice().sort()) {
      const [h, m] = time.split(':').map(Number);
      const slot = new Date(d); slot.setHours(h, m, 0, 0);
      if (slot.getTime() > now) return { at: slot.getTime(), durationMin: plan.durationMin };
    }
  }
  return null;
}

export function planIsValid(plan) {
  if (!plan.days.length || !plan.times.length) return { ok: false, reason: 'დღე ან საათი არ არის' };
  const mins = plan.times.map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; }).sort((a, b) => a - b);
  for (let i = 1; i < mins.length; i++) if (mins[i] - mins[i - 1] < plan.breakMin) return { ok: false, reason: `ორ სესიას შორის სულ მცირე ${plan.breakMin} წუთი უნდა იყოს` };
  if (plan.durationMin > 15) return { ok: false, reason: 'სესია 15 წუთზე მეტი არ უნდა იყოს' };
  return { ok: true };
}

export function toICS(plan, childName = 'ბავშვი', from = Date.now()) {
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byday = plan.days.map(d => dayNames[d]).join(',');
  const d = new Date(from);
  const stamp = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sitkva//KA'];
  plan.times.forEach((time, i) => {
    const [h, m] = time.split(':').map(Number);
    const start = new Date(d); start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + plan.durationMin * 60000);
    const fmt = x => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}${String(x.getMinutes()).padStart(2, '0')}00`;
    lines.push('BEGIN:VEVENT', `UID:sitkva-${i}-${stamp}`, `DTSTAMP:${stamp}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`, `SUMMARY:Sitkva: ${childName}, ${plan.durationMin} წთ`,
      'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Sitkva სესია 10 წუთში', 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// --- export ----------------------------------------------------------------
export function toCSV(log) {
  const cols = ['type', 't', 'sessionId', 'wordId', 'photoIndex', 'response', 'latencyMs', 'taps', 'realObject', 'characterId', 'durationMs', 'completed', 'calmAfterReward', 'refusals', 'questionId', 'answer', 'photoId', 'distractorId', 'distractorPhotoId', 'targetSide', 'wrongTaps', 'hinted'];
  const esc = v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return [cols.join(','), ...log.map(e => cols.map(c => esc(e[c])).join(','))].join('\n');
}

// --- evening questions ---------------------------------------------------
export const QUESTIONS = [
  { id: 'q_real_use', text: 'ითხოვა თუ არა დღეს რომელიმე სიტყვა აპის გარეშე (ჩვენებით, ჟესტით, ხმით)?', options: ['დიახ', 'არა', 'არ ვიცი'], effect: 'transfer' },
  { id: 'q_fav_toy', text: 'რომელი სათამაშო ან საჭმელი უყვარს ახლა ყველაზე მეტად?', options: ['ბურთი', 'მანქანა', 'წიგნი', 'სხვა'], effect: 'interest' },
  { id: 'q_reward_end', text: 'როგორი იყო სიუჟეტის დასრულებისას?', options: ['მშვიდად', 'ცოტა გაბრაზდა', 'ძალიან გაბრაზდა', 'სიუჟეტი არ ყოფილა'], effect: 'reward' },
  { id: 'q_voice', text: 'რომელ ხმაზე რეაგირებს უკეთ?', options: ['დედის', 'მამის', 'ორივეზე ერთნაირად'], effect: 'voice' },
  { id: 'q_best_time', text: 'რა დროს იყო ყველაზე მშვიდი?', options: ['დილით', 'შუადღეს', 'საღამოს'], effect: 'calendar' }
];

export function pickQuestions(log, now = Date.now(), count = 3) {
  const asked = {};
  for (const a of log.filter(e => e.type === 'answer')) asked[a.questionId] = Math.max(asked[a.questionId] || 0, a.t);
  return QUESTIONS.slice().sort((a, b) => (asked[a.id] || 0) - (asked[b.id] || 0)).slice(0, count);
}

export function ageText(birthDate, now = Date.now()) {
  const b = new Date(birthDate), n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 0) return '';
  const y = Math.floor(months / 12), m = months % 12;
  return y ? `${y} წელი და ${m} თვე` : `${m} თვე`;
}

// --- test gates (from the concept doc) -----------------------------------------
export function gateStatus(log, now = Date.now()) {
  const twoWeeks = now - 14 * 86400000;
  const sessions = log.filter(e => e.type === 'session' && e.startedAt >= twoWeeks);
  const days = new Set(sessions.filter(s => (s.durationMs || 0) >= 2 * 60000).map(s => dayKey(s.startedAt)));
  const calm = sessions.filter(s => s.completed && !s.distress).length;
  const g1 = { daysWithSession: days.size, calmPct: sessions.length ? Math.round(100 * calm / sessions.length) : 0 };
  g1.pass = g1.daysWithSession >= 7 && g1.calmPct >= 80;
  return { gate1: g1 };
}
