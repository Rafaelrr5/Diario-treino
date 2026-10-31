import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKOUTS, nextWorkout, lastEntry, bestKg, advice, parseBackup } from './logic.js';

const ex = WORKOUTS.A.exercises[0]; // 3 x 6-10
const s = (date, workout, entries, savedAt = 0) => ({ id: date + workout + savedAt, date, workout, savedAt, entries });

test('rotation continues A -> B -> C -> A regardless of weekday', () => {
  assert.equal(nextWorkout([]), 'A');
  assert.equal(nextWorkout([s('2026-10-01', 'A', {}), s('2026-10-03', 'B', {})]), 'C');
  assert.equal(nextWorkout([s('2026-10-05', 'C', {}), s('2026-10-01', 'A', {})]), 'A');
});

test('lastEntry and bestKg pick the right session', () => {
  const list = [
    s('2026-10-01', 'A', { [ex.id]: { kg: 40, reps: [10, 9, 8] } }),
    s('2026-10-08', 'A', { [ex.id]: { kg: 37.5, reps: [10, 10, 10] } }),
  ];
  assert.equal(lastEntry(list, ex.id).kg, 37.5);
  assert.equal(bestKg(list, ex.id), 40);
  assert.equal(lastEntry(list, 'nope'), null);
});

test('advice follows the sheet progression rule', () => {
  assert.equal(advice(ex, { kg: 40, reps: [10, 10, 10] }).kind, 'up');
  assert.equal(advice(ex, { kg: 40, reps: [10, 9, 8] }).kind, 'keep');
  assert.equal(advice(ex, { kg: 40, reps: [8, 6, 5] }).kind, 'down');
  assert.equal(advice(ex, { kg: 40, reps: [10, 10, null] }), null);
});

test('parseBackup rejects malformed files', () => {
  const good = [s('2026-10-01', 'A', { [ex.id]: { kg: 40, reps: [8, 8, 8] } })];
  assert.equal(parseBackup({ sessions: good }).length, 1);
  assert.throws(() => parseBackup({}));
  assert.throws(() => parseBackup([{ ...good[0], workout: 'Z' }]));
  assert.throws(() => parseBackup([{ ...good[0], entries: { x: { kg: '40', reps: [] } } }]));
});
