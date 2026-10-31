import { WORKOUTS, ORDER, nextWorkout, lastEntry, bestKg, advice, parseBackup, bySessionOrder } from './logic.js';

const KEY = 'diario-treino.sessions.v1';
const DRAFT = 'diario-treino.draft.v1';

const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
let sessions = load(KEY, []);
let draft = load(DRAFT, null);
let view = 'treino';

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
const fmtDate = (d) => d.split('-').reverse().slice(0, 2).join('/');
const fmtKg = (n) => (n == null ? '–' : `${String(n).replace('.', ',')} kg`);
const saveSessions = () => localStorage.setItem(KEY, JSON.stringify(sessions));
const saveDraft = () => localStorage.setItem(DRAFT, JSON.stringify(draft));

// Tiny element helper; text always goes through textContent.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return el;
}

function newDraft(workout) {
  const entries = {};
  for (const ex of WORKOUTS[workout].exercises) {
    const last = lastEntry(sessions, ex.id);
    entries[ex.id] = { kg: ex.unit === 's' ? null : last?.kg ?? null, reps: Array(ex.sets).fill(null) };
  }
  return { workout, date: today(), entries };
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function render() {
  const main = document.getElementById('main');
  main.replaceChildren(view === 'treino' ? treinoView() : view === 'historico' ? historicoView() : backupView());
  for (const b of document.querySelectorAll('nav button')) b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
}

function treinoView() {
  const suggested = nextWorkout(sessions);
  if (!draft) { draft = newDraft(suggested); saveDraft(); }
  const w = WORKOUTS[draft.workout];

  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ORDER.map((k) =>
    h('button', {
      role: 'tab', 'aria-selected': String(k === draft.workout), style: `--c:${WORKOUTS[k].color}`,
      onclick: () => {
        if (k === draft.workout) return;
        if (hasData(draft) && !confirm('Trocar de treino descarta o que você já anotou neste. Continuar?')) return;
        draft = newDraft(k); saveDraft(); render();
      },
    }, h('strong', {}, k), h('span', {}, k === suggested ? 'próximo' : WORKOUTS[k].name.split(',')[0])),
  ));

  const date = h('label', { class: 'date' }, 'Data ',
    h('input', { type: 'date', value: draft.date, max: today(), onchange: (e) => { draft.date = e.target.value || today(); saveDraft(); } }));

  const cards = w.exercises.map((ex, i) => exerciseCard(ex, i + 1, w.color));

  const save = h('button', { class: 'primary', style: `--c:${w.color}`, onclick: finish }, `Salvar treino ${draft.workout}`);
  return h('section', {}, tabs, h('p', { class: 'sub' }, w.name), date, ...cards, save,
    h('button', { class: 'ghost', onclick: () => { if (confirm('Limpar tudo que foi anotado agora?')) { draft = newDraft(draft.workout); saveDraft(); render(); } } }, 'Limpar anotações'));
}

function exerciseCard(ex, n, color) {
  const e = draft.entries[ex.id] ?? (draft.entries[ex.id] = { kg: null, reps: Array(ex.sets).fill(null) });
  const last = lastEntry(sessions, ex.id);
  const tip = advice(ex, last);
  const best = bestKg(sessions, ex.id);
  const unit = ex.unit === 's' ? 's' : 'reps';

  const kgInput = ex.unit === 's' ? null : h('label', { class: 'kg' }, 'Carga (kg)',
    h('input', {
      type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: e.kg ?? '', placeholder: last?.kg ?? '0',
      oninput: (ev) => { const v = parseFloat(ev.target.value.replace(',', '.')); e.kg = Number.isFinite(v) && v >= 0 ? v : null; saveDraft(); },
    }));

  const sets = h('div', { class: 'sets' }, e.reps.map((r, i) => h('label', {}, `Série ${i + 1}`,
    h('input', {
      type: 'number', inputmode: 'numeric', min: '0', max: '999', step: '1', value: r ?? '',
      placeholder: last?.reps[i] ?? `${ex.min}–${ex.max}`, 'aria-label': `${ex.name}, série ${i + 1}, ${unit}`,
      oninput: (ev) => { const v = parseInt(ev.target.value, 10); e.reps[i] = Number.isFinite(v) && v >= 0 ? v : null; saveDraft(); },
    }))));

  return h('article', { class: 'card', style: `--c:${color}` },
    h('header', {}, h('span', { class: 'n' }, n), h('div', {},
      h('h2', {}, ex.name),
      h('p', { class: 'meta' }, `${ex.sets} × ${ex.min}–${ex.max} ${ex.unit === 's' ? 's' : ''}${ex.note ? ` · ${ex.note}` : ''}`))),
    last ? h('p', { class: 'last' }, `Última (${fmtDate(last.date)}): ${ex.unit === 's' ? '' : fmtKg(last.kg) + ' · '}${last.reps.map((r) => r ?? '–').join(' / ')}${best != null ? ` · recorde ${fmtKg(best)}` : ''}`) : h('p', { class: 'last' }, 'Primeira vez: comece leve e confirme a técnica.'),
    tip ? h('p', { class: `tip ${tip.kind}` }, tip.text) : null,
    h('div', { class: 'inputs' }, kgInput, sets));
}

const hasData = (d) => Object.values(d.entries).some((e) => e.reps.some((r) => r > 0));

function finish() {
  const entries = {};
  for (const [id, e] of Object.entries(draft.entries)) if (e.reps.some((r) => r > 0)) entries[id] = { kg: e.kg, reps: e.reps };
  if (!Object.keys(entries).length) { toast('Anote pelo menos uma série antes de salvar.'); return; }
  const missingKg = Object.entries(entries).filter(([id, e]) => e.kg == null && !isTimed(id)).length;
  if (missingKg && !confirm(`${missingKg} exercício(s) sem carga anotada. Salvar mesmo assim?`)) return;
  sessions.push({ id: crypto.randomUUID(), date: draft.date, workout: draft.workout, savedAt: Date.now(), entries });
  saveSessions();
  const done = draft.workout;
  draft = null; localStorage.removeItem(DRAFT);
  toast(`Treino ${done} salvo. Próximo: ${nextWorkout(sessions)}.`);
  window.scrollTo(0, 0);
  render();
}

const isTimed = (id) => ORDER.some((k) => WORKOUTS[k].exercises.some((ex) => ex.id === id && ex.unit === 's'));

function historicoView() {
  if (!sessions.length) return h('section', {}, h('p', { class: 'empty' }, 'Nenhum treino salvo ainda.'));
  const exName = Object.fromEntries(ORDER.flatMap((k) => WORKOUTS[k].exercises.map((ex) => [ex.id, ex])));

  const progress = h('details', { class: 'card' }, h('summary', {}, 'Evolução por exercício'),
    ORDER.map((k) => h('div', { class: 'prog' }, h('h3', { style: `color:${WORKOUTS[k].color}` }, `Treino ${k}`),
      WORKOUTS[k].exercises.map((ex) => {
        const pts = sessions.filter((s) => s.entries[ex.id]).sort(bySessionOrder).slice(-6)
          .map((s) => ex.unit === 's' ? `${Math.max(...s.entries[ex.id].reps.map((r) => r ?? 0))}s` : (s.entries[ex.id].kg ?? '–'));
        return h('p', {}, h('span', {}, ex.name), h('b', {}, pts.length ? pts.join(' → ') : '–'));
      }))));

  const list = [...sessions].sort(bySessionOrder).reverse().map((s) => h('article', { class: 'card', style: `--c:${WORKOUTS[s.workout].color}` },
    h('header', {}, h('span', { class: 'n' }, s.workout), h('div', {}, h('h2', {}, fmtDate(s.date) + ' · ' + WORKOUTS[s.workout].name),
      h('p', { class: 'meta' }, `${Object.keys(s.entries).length} exercícios`))),
    h('ul', {}, Object.entries(s.entries).map(([id, e]) => h('li', {}, h('span', {}, exName[id]?.name ?? id),
      h('b', {}, `${exName[id]?.unit === 's' ? '' : fmtKg(e.kg) + ' · '}${e.reps.map((r) => r ?? '–').join(' / ')}`)))),
    h('button', { class: 'ghost danger', onclick: () => {
      if (!confirm(`Apagar o treino ${s.workout} de ${fmtDate(s.date)}?`)) return;
      sessions = sessions.filter((x) => x.id !== s.id); saveSessions(); render();
    } }, 'Apagar este treino')));
  return h('section', {}, progress, ...list);
}

function backupView() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const incoming = parseBackup(JSON.parse(await f.text()));
      const ids = new Set(sessions.map((s) => s.id));
      const added = incoming.filter((s) => !ids.has(s.id));
      sessions = sessions.concat(added); saveSessions();
      toast(`${added.length} treino(s) importado(s).`); render();
    } catch (err) { toast(`Não deu para importar: ${err.message}.`); }
    ev.target.value = '';
  } });
  return h('section', {},
    h('article', { class: 'card' }, h('h2', {}, 'Seus dados ficam neste aparelho'),
      h('p', {}, 'Nada vai para a internet. Se limpar os dados do navegador ou trocar de celular, os registros somem. Baixe um backup de vez em quando e guarde no Drive.'),
      h('p', { class: 'meta' }, `${sessions.length} treino(s) salvos.`),
      h('button', { class: 'primary', onclick: () => {
        const blob = new Blob([JSON.stringify({ app: 'diario-treino', version: 1, exportedAt: new Date().toISOString(), sessions }, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `treinos-${today()}.json` });
        a.click(); URL.revokeObjectURL(a.href);
      } }, 'Baixar backup'),
      h('button', { class: 'ghost', onclick: () => file.click() }, 'Importar backup'), file));
}

for (const b of document.querySelectorAll('nav button')) b.addEventListener('click', () => { view = b.dataset.view; window.scrollTo(0, 0); render(); });
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
