import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import charts from './learning-charts.js';

assert.deepEqual(charts.donutSegments([0, 0]).map(s => s.share), [0, 0]);
assert.deepEqual(charts.donutSegments([3, 0]).map(s => s.share), [100, 0]);
assert.deepEqual(charts.donutSegments([1, 1, 2]).map(s => [s.share, s.offset]), [[25, 0], [25, 25], [50, 50]]);
assert.throws(() => charts.donutSegments([-1]), RangeError);
assert.throws(() => charts.donutSegments([NaN]), RangeError);
const weeks = charts.weeklySeries([
  { date: '2023-12-31', plannedMinutes: 30, minutes: 0 },
  { date: '2024-01-01', plannedMinutes: 45, minutes: 30 },
  { date: '2024-01-07', plannedMinutes: 20, minutes: 15 },
  { date: '2024-01-14', plannedMinutes: 999, minutes: 999 }
], '2024-01-08', 2);
assert.deepEqual(weeks, [
  { start: '2023-12-31', end: '2024-01-06', planned: 75, completed: 30 },
  { start: '2024-01-07', end: '2024-01-13', planned: 20, completed: 15 }
]);
assert.equal(charts.weeklySeries([{ date: '2024-02-29', minutes: 25 }], '2024-03-01', 1)[0].completed, 25);
assert.equal(charts.weeklySeries([], '2026-09-30').length, 8);
assert.deepEqual(charts.quizOutcomes([]), { correct: 0, incorrect: 0, skipped: 0, total: 0, percent: null });
const quizAttempts = [
  { status: 'submitted', result: { correct: 1, incorrect: 0, skipped: 0, total: 1, percent: 100 } },
  { status: 'submitted', result: { correct: 2, incorrect: 3, skipped: 5, total: 10, percent: 20 } },
  { status: 'in-progress', result: { correct: 100, incorrect: 0, skipped: 0 } },
  { status: 'abandoned', result: { correct: 100, incorrect: 0, skipped: 0 } }
];
assert.deepEqual(charts.quizOutcomes(quizAttempts), { correct: 3, incorrect: 3, skipped: 5, total: 11, percent: 27 });
assert.deepEqual(charts.quizOutcomes(quizAttempts.slice(1, 2)), { correct: 2, incorrect: 3, skipped: 5, total: 10, percent: 20 });

// Check the actual view's default, dropdown selection, and journey isolation.
let journey = { id: 'journey-a', items: [{ id: 'quiz-task', title: 'Java loops assessment' }] };
const attempts = quizAttempts.slice(0, 2).map((attempt, index) => ({ ...attempt, id: `quiz-${index}`, journeyId: journey.id, itemId: index ? null : 'quiz-task', topics: ['Java'], questions: [], submittedAt: '2026-10-01T12:30:00Z' }));
attempts.push({ ...attempts[0], id: 'other-journey-quiz', journeyId: 'journey-b' });
const ui = {};
const view = vm.runInNewContext(`(${readFileSync(new URL('./app.js', import.meta.url), 'utf8').match(/function progressPage\([^)]*\)\{[\s\S]*?\n\}/)[0]})`, {
  ui, window: { LearnioCharts: charts }, chartColors: [],
  store: { getJourney: () => journey, getData: () => ({ attempts, evidence: [] }), getStats: () => ({ percent: 0, completed: 0, total: 1, completedMinutes: 0, topics: [], learningMix: [] }), getActivityYear: () => ({ activeDays: 0, year: 2026 }) },
  dateKey: () => '2026-10-01', head: () => '', metric: () => '', activityPanel: () => '', weeklyChart: () => '',
  duration: String, esc: String, icon: () => '', button: () => '', badge: () => '', chartLegend: () => '',
  quizParts: result => [result.correct, result.incorrect, result.skipped],
  donutChart: (parts, center, _caption, label) => `${label}:${center}:${parts.join(',')}`,
  empty: title => title
});
const aggregateView = view();
assert.ok(aggregateView.includes('<option value="" selected>All quizzes</option>'));
assert.ok(aggregateView.includes('All quizzes answer distribution:27%:3,3,5'));
assert.ok(aggregateView.includes('Java loops assessment · Java ·'));
assert.ok(!aggregateView.includes('other-journey-quiz'));
ui.progressAttempt = 'quiz-1';
assert.ok(view().includes('Quiz answer distribution:20%:2,3,5'));
ui.progressAttempt = 'deleted-quiz';
assert.ok(view().includes('All quizzes answer distribution:27%:3,3,5'));
assert.equal(ui.progressAttempt, '');
ui.progressAttempt = 'other-journey-quiz';
journey = { id: 'journey-b', items: [] };
assert.ok(view().includes('All quizzes answer distribution:100%:1,0,0'));
assert.equal(ui.progressAttempt, '');
journey = { id: 'empty-journey', items: [] };
assert.ok(view().includes('Your first check-in awaits'));
console.log('Chart checks passed: proportional donuts, weekly boundaries, leap-day totals, weighted quiz outcomes, aggregate default, dropdown selection, journey isolation, and empty results.');
