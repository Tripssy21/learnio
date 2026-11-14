import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import plan from './journey-plan.js';

const tasks = [
  { id: 'sunday', date: '2024-01-07', startTime: '19:00', type: 'problem', minutes: 20, completedAt: null },
  { id: 'new-year', date: '2024-01-01', startTime: '19:00', type: 'lesson', minutes: 30, completedAt: '2024-01-01T19:00:00Z' },
  { id: 'late', date: '2024-01-01', startTime: '20:00', type: 'quiz', minutes: 10, completedAt: null },
  { id: 'year-end', date: '2023-12-31', startTime: '19:00', type: 'review', minutes: 15, completedAt: null },
  { id: 'undated', minutes: 999 },
  { id: 'invalid', date: '2024-02-30', minutes: 999 }
];
const originalOrder = tasks.map(task => task.id);
const weeks = plan.buildWeeks(tasks, '2024-01-15', '2023-12-25');
assert.deepEqual(weeks.map(week => [week.startDate, week.endDate, week.tasks.length, week.completed, week.minutes]), [
  ['2023-12-25', '2023-12-31', 1, 0, 15],
  ['2024-01-01', '2024-01-07', 3, 1, 60],
  ['2024-01-08', '2024-01-14', 0, 0, 0],
  ['2024-01-15', '2024-01-21', 0, 0, 0]
]);
assert.deepEqual(weeks[1].tasks.map(task => task.id), ['new-year', 'late', 'sunday']);
assert.deepEqual(tasks.map(task => task.id), originalOrder, 'Rendering must preserve the stored task order.');
assert.equal(plan.currentWeekIndex(weeks, '2024-01-07'), 1);
assert.equal(plan.currentWeekIndex(weeks, '2023-12-01'), 0);
assert.equal(plan.currentWeekIndex(weeks, '2024-02-01'), 3);
assert.equal(plan.currentWeekIndex([], '2024-01-01'), -1);
assert.throws(() => plan.buildWeeks([], '2024-02-30'), RangeError);
assert.equal(plan.buildWeeks([{ date: '2024-02-29', minutes: 25 }], '2024-03-01')[0].endDate, '2024-03-03');
assert.deepEqual(plan.buildWeeks([{ date: '2024-03-10' }, { date: '2024-03-11' }], '2024-03-11').map(week => [week.startDate, week.tasks.length]), [['2024-03-04', 1], ['2024-03-11', 1]], 'DST boundaries must not move a session to another date.');
assert.equal(plan.buildWeeks([], '2024-01-01')[0].startDate, '2024-01-01');
assert.equal(plan.buildWeeks([], '2024-01-01', '2024-01-17')[0].startDate, '2024-01-15', 'A future journey starts at its own first week.');

const journey = {
  contentReferences: [{ id: 'course', version: 1, title: 'Saved course' }, { id: 'sheet', version: 2, title: 'Saved practice sheet' }],
  items: [{ id: 'lesson', sourceId: 'lesson-source', type: 'lesson' }, { id: 'problem', sourceId: 'problem-source', type: 'problem' }]
};
const catalogue = [
  { id: 'course', version: 1, type: 'course', title: 'Course', items: [{ sourceId: 'lesson-source' }] },
  { id: 'sheet', version: 2, type: 'sheet', title: 'Sheet', items: [{ sourceId: 'problem-source' }] }
];
const groups = plan.groupWeek([
  { itemId: 'lesson', minutes: 20, completedAt: 'done' },
  { itemId: 'lesson', minutes: 15 },
  { itemId: 'problem', minutes: 30 },
  { type: 'quiz', minutes: 10 },
  { type: 'review', minutes: 5 }
], journey, catalogue);
assert.deepEqual(groups.map(group => [group.type, group.title, group.tasks.length, group.completed, group.minutes]), [
  ['course', 'Saved course', 2, 1, 35],
  ['sheet', 'Saved practice sheet', 1, 0, 30],
  ['quiz', 'Quizzes', 1, 0, 10],
  ['review', 'Review', 1, 0, 5]
]);
assert.equal(plan.groupWeek([{ itemId: 'lesson', minutes: 20 }], journey, [{ ...catalogue[0], version: 2 }])[0].title, 'Course lessons', 'New catalogue versions cannot rename an adopted version.');
assert.equal(plan.groupWeek([{ type: 'lesson', item: { sourceId: 'lesson-source' }, minutes: 20 }], {}, catalogue)[0].title, 'Course lessons', 'Unadopted catalogue entries must not claim a personal item.');
assert.equal(plan.groupWeek([{ type: 'problem', minutes: NaN }, { type: 'problem', minutes: -1 }], {})[0].minutes, 0);

// Render the actual calendar: include only the complete weeks that contain the month.
const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const ui = { month: '2026-09', filters: {} };
let calendarTasks = [];
const localDateKey = date => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '2026-10-01';
const context = {
  ui, store: { getJourney: () => ({ id: 'journey' }), getTasks: () => calendarTasks },
  dateKey: localDateKey, formatDate: String, duration: String, esc: String,
  head: () => '', button: () => '', multiSelect: () => '', icon: () => '', badge: () => '',
  activityType: type => ({ label: type, icon: type }), taskRow: () => '', empty: title => `<empty-state>${title}</empty-state>`,
  calendarTaskMatches: task => !ui.filters.activity?.length || ui.filters.activity.includes(task.type)
};
context.dayPlanCard = vm.runInNewContext(`(${source.match(/function dayPlanCard\(key,tasks\)\{[^\n]+/)[0]})`, context);
const calendarView = vm.runInNewContext(`(${source.match(/function calendarPage\(\)\{[\s\S]*?\n\}/)[0]})`, context);
for (const [month, count, first, last] of [
  ['2026-09', 35, '2026-08-31', '2026-10-04'],
  ['2021-02', 28, '2021-02-01', '2021-02-28'],
  ['2024-02', 35, '2024-01-29', '2024-03-03'],
  ['2026-08', 42, '2026-07-27', '2026-09-06']
]) {
  ui.month = month;
  const dates = [...calendarView().matchAll(/class="calendar-day-head" data-calendar-day="([^"]+)"/g)].map(match => match[1]);
  assert.equal(dates.length, count, `${month} must contain only its intersecting Monday–Sunday weeks.`);
  assert.equal(dates[0], first);
  assert.equal(dates.at(-1), last);
  assert.equal(new Set(dates).size, count);
}
ui.month = '2026-09';
const emptyCalendar = calendarView();
assert.equal((emptyCalendar.match(/<small class="calendar-open">Nothing scheduled<\/small>/g) || []).length, 35);
assert.ok(emptyCalendar.includes('<empty-state>Nothing scheduled</empty-state>'), 'An unscheduled month needs the same empty state on mobile.');
assert.ok(!emptyCalendar.includes('Recharge & reset'));
assert.ok(context.dayPlanCard('2026-09-02', []).includes('Nothing scheduled'));
calendarTasks = [{ date: '2026-09-02', type: 'lesson', title: 'Saved lesson', topic: 'Java', itemId: 'lesson', startTime: '19:00', minutes: 30 }];
assert.ok(calendarView().includes('<strong>Saved lesson</strong>'));
ui.filters.activity = ['quiz'];
const filteredCalendar = calendarView();
assert.equal((filteredCalendar.match(/<small class="calendar-open">No matching sessions<\/small>/g) || []).length, 1);
assert.equal((filteredCalendar.match(/<small class="calendar-open">Nothing scheduled<\/small>/g) || []).length, 34);
assert.ok(filteredCalendar.includes('<empty-state>No matching sessions</empty-state>'), 'A filtered month must not imply its saved sessions are unscheduled.');
assert.ok(!filteredCalendar.includes('<strong>Saved lesson</strong>'));
console.log('Journey plan checks passed: Monday weeks, date boundaries, saved content groups, minimal month grids, and accurate empty/filtered day labels.');
