import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createStore } = require('./learning-store.js');
const catalogueStore = createStore({ storage: { getItem: () => null, setItem() {} } });

// Run the actual application functions and registered handlers; no server or private records.
const handlers = new Map(), nodes = new Map(), calls = [], dialogs = [];
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
const node = () => ({ innerHTML: '', textContent: '', hidden: true, disabled: false, isConnected: true, dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, scrollIntoView() {}, focus() {} });
class TestForm {
  constructor(id, values = {}, dataset = {}) {
    this.id = id; this.dataset = dataset; this.elements = []; this.error = node(); this.submit = node(); this.preview = node();
    this.entries = Object.entries(values).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(v => [key, String(v)]));
  }
  querySelector(selector) { return selector === '.form-error' ? this.error : selector.includes('submit') ? this.submit : selector === '#journey-preview' ? this.preview : null; }
}
class TestFormData {
  constructor(form) { this.entries = form.entries; }
  get(key) { return this.entries.find(([name]) => name === key)?.[1] ?? null; }
  getAll(key) { return this.entries.filter(([name]) => name === key).map(([, value]) => value); }
  has(key) { return this.entries.some(([name]) => name === key); }
  [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
}
let user = { id: 'learner', displayName: 'Test learner', username: 'test_learner', timezone: 'Asia/Kolkata', educator: false };
let journey = { id: 'personal', title: 'Personal arrays plan', goal: 'Learn arrays', status: 'active', startDate: '2026-10-08', availability: catalogueStore.defaults, items: [] };
let tasks = [], attempts = [], evidence = [], draft = null;
let academy = { institutions: [], courses: [], semesters: [] };
const store = {
  today: () => '2026-10-08', defaults: catalogueStore.defaults, catalogue: catalogueStore.catalogue,
  getUser: () => user, getJourney: () => journey, getJourneys: () => journey ? [journey] : [],
  getTasks: () => tasks, getData: () => ({ attempts, evidence, draft, memberships: [] }),
  getStats: () => ({ completed: 1, total: journey?.items.length || 0, percent: 20 }),
  getCoveredTopics: () => ['Arrays'], getWorkspace: () => academy,
  previewJourney: async fields => { calls.push(['previewJourney', fields]); return { ok: true, tasks: [{ date: '2026-10-09', startTime: '21:00', minutes: 30, title: 'Chosen lesson' }], finishDate: '2026-10-09', targetDate: '2026-10-14', warnings: [], unscheduled: [] }; },
  createJourney: async fields => { calls.push(['createJourney', fields]); return { ok: true, journeyId: 'new-personal' }; },
  adoptJourney: async (entryId, fields) => { calls.push(['adoptJourney', entryId, fields]); return { ok: true, journeyId: 'adopted-personal' }; },
  completeTask: async (...args) => { calls.push(['completeTask', ...args]); return { ok: true }; },
  completeItem: async (...args) => { calls.push(['completeItem', ...args]); return { ok: true }; },
  updateScheduledQuiz: async (...args) => { calls.push(['updateScheduledQuiz', ...args]); return { ok: true }; },
  scheduleQuiz: async fields => { calls.push(['scheduleQuiz', fields]); return { ok: true }; },
  cancelScheduledQuiz: async (...args) => { calls.push(['cancelScheduledQuiz', ...args]); return { ok: true }; }
};
nodes.set('#app', node()); nodes.set('#toast', node());
const document = {
  title: '', activeElement: node(), documentElement: { dataset: {} }, body: node(),
  querySelector: selector => nodes.get(selector) ?? null, querySelectorAll: () => [],
  addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); }
};
const context = vm.createContext({
  document, localStorage: memory(), sessionStorage: memory(), FormData: TestFormData, HTMLFormElement: TestForm,
  URL, URLSearchParams, TextEncoder, structuredClone, crypto: globalThis.crypto,
  location: { hash: '' }, history: { state: null, replaceState() {}, pushState() {} },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
  window: { LearnioStore: store, learnioReady: Promise.resolve({ ok: false }), addEventListener() {}, scrollTo() {}, LearnioAcademy: { handleClick: async () => false, handleSubmit: async () => false, handleChange: () => false } }
});
vm.runInContext(readFileSync(new URL('./app.js', import.meta.url), 'utf8'), context, { filename: 'app.js' });
context.openDialog = (...args) => dialogs.push(args); context.closeDialog = () => {};
context.render = () => {}; context.notice = () => {};
const ui = values => { context.nextUi = values; vm.runInContext('Object.assign(ui,nextUi)', context); };
const invoke = async (type, event) => { for (const handler of handlers.get(type) || []) await handler(event); };
const click = async dataset => { const target = { dataset }; target.closest = () => target; await invoke('click', { target }); };
const submit = async form => invoke('submit', { target: form, preventDefault() {} });
const task = (id, itemId, title, date, completedAt = null) => ({ id, itemId, title, date, type: 'lesson', topic: 'Arrays', startTime: '18:00', endTime: '18:30', minutes: 30, status: completedAt ? 'Completed' : 'Planned', completedAt });
tasks = [task('missed-task', 'missed-item', 'Missed arrays lesson', '2026-10-07'), task('today-task', 'today-item', 'Today arrays lesson', '2026-10-08'), task('done-task', 'done-item', 'Finished arrays lesson', '2026-10-08', '2026-10-08T06:00:00Z'), task('future-task', 'future-item', 'Future arrays lesson', '2026-10-09')];
journey.items = tasks.map(t => ({ id: t.itemId, title: t.title, type: t.type, topic: t.topic, duration: 60, description: 'Read and practice', content: 'Lesson body', completedAt: t.completedAt }));
ui({ page: 'Today', workspace: 'learning', quizId: null });
const agenda = context.todayPage();
assert.ok(agenda.includes('<h2>Missed sessions</h2>'));
assert.equal((agenda.match(/<article class="task-row /g) || []).length, 3, 'Each today/missed session has one agenda row; resources do not repeat them.');
assert.ok(!agenda.includes('Today’s resources'));
assert.ok(agenda.includes('data-item="today-item" data-task-id="today-task"'));
assert.ok(agenda.includes('data-item="missed-item" data-task-id="missed-task"'));
tasks = tasks.filter(t => t.id === 'missed-task');
assert.ok(context.todayPage().includes('Review missed sessions below'), 'An otherwise empty Today points to unfinished work.');
journey = null;
const firstUse = context.todayPage();
assert.ok(firstUse.includes('Explore journeys') && firstUse.includes('Build my plan'));
journey = { id: 'personal', title: 'Personal arrays plan', status: 'active', availability: catalogueStore.defaults, items: [{ id: 'today-item', title: 'Arrays lesson', type: 'lesson', topic: 'Arrays', duration: 60, content: 'Lesson body', description: 'Practice arrays', completedAt: null }] };
tasks = [task('today-task', 'today-item', 'Arrays lesson', '2026-10-08'), task('later-task', 'today-item', 'Arrays lesson', '2026-10-09')];
await click({ item: 'today-item', taskId: 'today-task' });
const sessionDialog = dialogs.at(-1);
assert.ok(sessionDialog[0].includes('session'));
assert.ok(sessionDialog[1].includes('data-task-id="today-task"'));
assert.ok(sessionDialog[1].includes('Complete this session'));
assert.ok(sessionDialog[1].includes('Complete the whole item…'));
assert.ok(sessionDialog[1].indexOf('Complete this session') < sessionDialog[1].indexOf('Complete the whole item…'));
await submit(new TestForm('item-form', { note: 'Session note', url: 'https://example.test/solution' }, { itemId: 'today-item', taskId: 'today-task' }));
assert.deepEqual(calls.at(-1).slice(0, 3), ['completeTask', 'personal', 'today-task']);
assert.equal(calls.at(-1)[3].note, 'Session note');
assert.equal(calls.at(-1)[3].url, 'https://example.test/solution');

ui({ page: 'Journey setup', setupEntryId: 'dsa-journey' });
const setupHtml = context.journeySetupPage();
assert.ok(setupHtml.includes('name="startTime"') && setupHtml.includes('name="day0"') && setupHtml.includes('name="day6"'));
assert.ok(!setupHtml.includes('name="planningMode"'), 'There is one availability-driven planning rule.');
const setupValues = { title: 'Evening plan', goal: 'Practice arrays', startDate: '2026-10-08', weeklyHours: 3.5, startTime: '21:00', targetWeeks: 2, day0: .5, day1: .5, day2: .5, day3: .5, day4: .5, day5: .5, day6: .5, entryId: 'dsa-journey', extend: 'on' };
const setupForm = new TestForm('journey-form', setupValues);
nodes.set('#journey-form', setupForm);
await click({ action: 'preview-journey' });
const previewCall = calls.at(-1);
assert.equal(previewCall[0], 'previewJourney');
assert.equal(previewCall[1].entryId, 'dsa-journey');
assert.equal(previewCall[1].availability.startTime, '21:00');
assert.equal(previewCall[1].availability.days[0], .5);
assert.equal(previewCall[1].allowLaterFinish, true);
assert.ok(setupForm.preview.innerHTML.includes('Chosen lesson'));
await submit(setupForm);
assert.equal(calls.at(-1)[0], 'adoptJourney');
assert.equal(calls.at(-1)[2].availability.startTime, '21:00', 'Adoption uses exactly the previewed availability.');
await submit(new TestForm('journey-form', { ...setupValues, entryId: 'python-course' }));
assert.equal(calls.at(-1)[0], 'createJourney');
assert.equal(calls.at(-1)[1].contentIds[0], 'python-course');
assert.equal(calls.at(-1)[1].availability.days[6], .5, 'Creation does not overwrite actual day choices with weekdays at 18:00.');

journey.items.push({ id: 'scheduled-quiz', type: 'quiz', title: 'Arrays check-in', topic: 'Arrays', topics: ['Arrays'], difficulty: 'Beginner', duration: 10 });
tasks.push({ ...task('quiz-task', 'scheduled-quiz', 'Arrays check-in', '2026-10-10'), type: 'quiz', fixed: true, minutes: 10 });
ui({ page: 'Quizzes', quizId: null });
const quizzesHtml = context.quizzesPage();
assert.ok(quizzesHtml.includes('data-edit-quiz="scheduled-quiz"'));
assert.ok(quizzesHtml.includes('data-cancel-quiz="scheduled-quiz"'));
assert.ok(quizzesHtml.includes('<option value="0">Untimed'));
assert.ok(quizzesHtml.includes('continues counting down after you leave'));
await click({ editQuiz: 'scheduled-quiz' });
assert.ok(dialogs.at(-1)[1].includes('data-item-id="scheduled-quiz"'));
ui({ quizReturnPage: 'Journey plan' });
await submit(new TestForm('schedule-quiz-form', { date: '2026-10-11', startTime: '21:00', minutes: 20, difficulty: 'Beginner', topics: ['Arrays'] }, { itemId: 'scheduled-quiz' }));
assert.equal(calls.at(-1)[0], 'updateScheduledQuiz');
assert.equal(calls.at(-1)[2], 'scheduled-quiz');
assert.equal(vm.runInContext('ui.page', context), 'Journey plan', 'Scheduling returns to its origin instead of forcing Calendar.');
await click({ action: 'cancel-scheduled', itemId: 'scheduled-quiz' });
assert.deepEqual(calls.at(-1), ['cancelScheduledQuiz', 'personal', 'scheduled-quiz']);
const untimed = { id: 'untimed', status: 'in-progress', answers: {}, expiresAt: null, questions: [] };
assert.ok(context.attemptPage(untimed).includes('resume without a time limit'));
assert.ok(!context.attemptPage(untimed).includes('clock continues'));
journey.items.find(i => i.id === 'scheduled-quiz').cancelledAt = '2026-10-08T06:00:00Z';
ui({ page: 'Quizzes' });
assert.ok(!context.quizzesPage().includes('data-edit-quiz="scheduled-quiz"'));
assert.ok(context.quizzesPage().includes('Cancelled · history retained'));

ui({ page: 'Portfolio', workspace: 'learning', courseId: '' });
const accountHead = context.head('Your profile', 'Account-wide evidence');
assert.ok(accountHead.includes('YOUR LEARNIO ACCOUNT'));
assert.ok(!accountHead.includes('Personal arrays plan'));
ui({ page: 'Overview', workspace: 'course', courseId: 'public-course' });
academy = { institutions: [], courses: [{ id: 'public-course', canTeach: false }], semesters: [] };
const learnerNav = context.navigation().flatMap(([, pages]) => pages.map(([page]) => page));
assert.ok(learnerNav.includes('Learning') && !learnerNav.includes('Materials'));
academy.courses[0].canTeach = true;
const teacherNav = context.navigation().flatMap(([, pages]) => pages.map(([page]) => page));
assert.ok(teacherNav.includes('Materials') && !teacherNav.includes('Learning'));
assert.equal(teacherNav.filter(page => page === 'Assessments').length, 1);
console.log('Personal UI checks passed: single agenda/missed work, exact task scope, setup preview/adoption availability, quiz ownership/origin, untimed wording and account/role navigation.');
