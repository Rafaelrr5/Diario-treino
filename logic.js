// Pure logic (no DOM) so it can be tested with `node --test`.

export const WORKOUTS = {
  A: {
    name: 'Peito, ombros e tríceps',
    color: '#007f80',
    exercises: [
      { id: 'supino-maquina', name: 'Supino na máquina articulada', sets: 3, min: 6, max: 10 },
      { id: 'supino-inclinado-halter', name: 'Supino inclinado com halteres', sets: 3, min: 8, max: 12 },
      { id: 'crucifixo-cross', name: 'Crucifixo no cross em pé', sets: 3, min: 12, max: 15 },
      { id: 'elevacao-lateral-maquina', name: 'Elevação lateral na máquina', sets: 3, min: 12, max: 20 },
      { id: 'triceps-corda', name: 'Tríceps na corda', sets: 3, min: 10, max: 15 },
      { id: 'triceps-frances-unilateral', name: 'Tríceps francês unilateral em pé', sets: 3, min: 10, max: 15, note: 'por braço' },
    ],
  },
  B: {
    name: 'Pernas completas e abdômen',
    color: '#8b5b22',
    exercises: [
      { id: 'leg-press-45', name: 'Leg press 45°', sets: 3, min: 6, max: 10 },
      { id: 'terra-romeno-halter', name: 'Terra romeno com halteres (RDL)', sets: 3, min: 8, max: 12 },
      { id: 'cadeira-extensora', name: 'Cadeira extensora', sets: 3, min: 10, max: 15 },
      { id: 'mesa-flexora', name: 'Mesa flexora deitada', sets: 3, min: 10, max: 15 },
      { id: 'panturrilha-sentada', name: 'Panturrilha sentada', sets: 3, min: 12, max: 20 },
      { id: 'prancha-lateral', name: 'Prancha lateral', sets: 2, min: 20, max: 40, unit: 's', note: 'segundos, lado mais fraco' },
    ],
  },
  C: {
    name: 'Costas e bíceps',
    color: '#416ba4',
    exercises: [
      { id: 'puxada-alta', name: 'Puxada alta pela frente', sets: 3, min: 6, max: 10 },
      { id: 'remada-baixa-aberta', name: 'Remada baixa com pegada aberta', sets: 3, min: 8, max: 12 },
      { id: 'remada-unilateral-halter', name: 'Remada unilateral com halter', sets: 3, min: 10, max: 12, note: 'por lado' },
      { id: 'crucifixo-inverso', name: 'Crucifixo inverso na máquina', sets: 3, min: 12, max: 15 },
      { id: 'rosca-banco-inclinado', name: 'Rosca no banco inclinado', sets: 3, min: 10, max: 15 },
      { id: 'rosca-martelo', name: 'Rosca martelo', sets: 3, min: 10, max: 15 },
    ],
  },
};

export const ORDER = ['A', 'B', 'C'];

// Rotation from the sheet: "depois do B vem o C, mesmo na semana seguinte".
export function nextWorkout(sessions) {
  if (!sessions.length) return 'A';
  const last = [...sessions].sort(bySessionOrder).at(-1).workout;
  return ORDER[(ORDER.indexOf(last) + 1) % ORDER.length];
}

export function bySessionOrder(a, b) {
  return a.date === b.date ? a.savedAt - b.savedAt : a.date < b.date ? -1 : 1;
}

// Most recent saved entry for an exercise, or null.
export function lastEntry(sessions, exId) {
  const sorted = [...sessions].sort(bySessionOrder);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i].entries[exId];
    if (e && e.reps.some((r) => r > 0)) return { ...e, date: sorted[i].date };
  }
  return null;
}

// Heaviest load ever logged for the exercise (with at least one rep).
export function bestKg(sessions, exId) {
  let best = null;
  for (const s of sessions) {
    const e = s.entries[exId];
    if (e && e.kg != null && e.reps.some((r) => r > 0) && (best == null || e.kg > best)) best = e.kg;
  }
  return best;
}

// Progression rule from the sheet ("Quando aumentar a carga").
export function advice(ex, entry) {
  if (!entry) return null;
  const done = entry.reps.slice(0, ex.sets);
  if (done.length < ex.sets || done.some((r) => !(r > 0))) return null;
  if (done.every((r) => r >= ex.max)) return { kind: 'up', text: ex.unit === 's' ? 'Bateu o topo: aumente o tempo' : 'Bateu o topo da faixa: suba o menor incremento' };
  if (done.some((r) => r < ex.min)) return { kind: 'down', text: 'Abaixo da faixa: mantenha ou reduza a carga' };
  return { kind: 'keep', text: 'Dentro da faixa: mantenha a carga e busque mais repetições' };
}

// Accepts a backup file's parsed JSON; returns sessions or throws.
export function parseBackup(data) {
  const sessions = Array.isArray(data) ? data : data?.sessions;
  if (!Array.isArray(sessions)) throw new Error('Arquivo sem sessões');
  for (const s of sessions) {
    if (typeof s.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !WORKOUTS[s.workout] || typeof s.entries !== 'object' || s.entries === null) {
      throw new Error('Sessão inválida no arquivo');
    }
    for (const e of Object.values(s.entries)) {
      if (!Array.isArray(e.reps) || !(e.kg === null || typeof e.kg === 'number')) throw new Error('Registro inválido no arquivo');
    }
  }
  return sessions;
}
