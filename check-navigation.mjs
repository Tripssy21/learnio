import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

// Exercise the browser-facing routing code with an in-memory browser history.
const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const navigationSource = source.slice(source.indexOf('const learningNav='), source.indexOf('function render('));
const renderSource = source.slice(source.indexOf('function render('), source.indexOf('function head('));
const routeSource = source.slice(source.indexOf('function navigationView('), source.indexOf('function enrollmentImportDialog('));
assert.ok(routeSource.startsWith('function navigationView('), 'Navigation helpers must remain runnable by this check.');

function browser({ entries = [{ hash: '#Today?journey=j1', state: null }], cursor = 0, saved = [], userId = 'student', storageUnavailable = false } = {}) {
  entries = copy(entries);
  const storage = new Map(saved), controls = [{ dataset: { action: 'navigation-back' } }, { dataset: { action: 'navigation-forward' } }], shell = { inert: false };
  const ui = { page: 'Today', workspace: 'learning', month: '2026-10', quizId: null, courseId: '', filters: {}, query: '' };
  const profile = id => ({ id, educator: true, displayName: 'Test User', username: id });
  let user = profile(userId), selected = 'j1', selectionHook = async () => {}, active = 0, peak = 0, closed = 0, writes = Promise.resolve();
  const rendered = [], selections = [], journeys = [{ id: 'j1', title: 'First journey', status: 'active' }, { id: 'j2', title: 'Second journey', status: 'active' }];
  const location = { hash: entries[cursor].hash, pathname: '/', search: '', href: `http://localhost/${entries[cursor].hash}` };
  const setLocation = hash => { location.hash = hash; location.href = `http://localhost/${hash}`; };
  const history = {
    get state() { return entries[cursor].state; },
    get length() { return entries.length; },
    replaceState(state, _, hash) { entries[cursor] = { state: copy(state), hash: String(hash || location.hash) }; setLocation(entries[cursor].hash); },
    pushState(state, _, hash) { entries.splice(cursor + 1); entries.push({ state: copy(state), hash: String(hash) }); cursor++; setLocation(String(hash)); },
    go(delta) { cursor = Math.max(0, Math.min(entries.length - 1, cursor + delta)); setLocation(entries[cursor].hash); }
  };
  const store = {
    getUser: () => user,
    today: () => '2026-10-05',
    getJourney: id => journeys.find(journey => journey.id === (id || selected)),
    getJourneys: () => journeys,
    getStats: () => ({ percent: 0 }),
    getAttempt: id => ({ a1: { id: 'a1', journeyId: 'j1' }, a2: { id: 'a2', journeyId: 'j2' } })[id],
    getWorkspace: () => ({ institutions: [{ id: 'northstar', role: 'student' }], courses: [{ id: 'college-course', institutionId: 'northstar', learnerIds: [user.id] }, { id: 'public-course', ownerId: 'teacher', learnerIds: [user.id] }] }),
    selectJourney(id) {
      const pending = writes.then(async () => {
        selections.push(id); active++; peak = Math.max(peak, active);
        try { await selectionHook(id); selected = id; return { ok: true }; } finally { active--; }
      });
      writes = pending.catch(() => {});
      return pending;
    },
    whenIdle: () => writes
  };
  const context = vm.createContext({
    ui, store, history, location, URLSearchParams, Date, crypto: webcrypto,
    sessionStorage: {
      getItem: key => { if (storageUnavailable) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (storageUnavailable) throw new Error('Storage blocked'); storage.set(key, String(value)); },
      removeItem: key => { if (storageUnavailable) throw new Error('Storage blocked'); storage.delete(key); }
    },
    document: { querySelectorAll: () => controls, querySelector: selector => selector === '.shell' ? shell : selector.includes('back') ? controls[0] : selector.includes('forward') ? controls[1] : null },
    icon: value => `<svg>${value}</svg>`, esc: value => String(value ?? ''), initials: () => 'TU', dateKey: () => store.today(), clearInterval,
    closeDialog: () => closed++, notice: message => { throw new Error(message); },
    app: { innerHTML: '' }, pageContent: () => { rendered.push(copy(ui)); return ''; }, courseSelector: () => '', applySidebarLayout: () => {}, syncMobileNavigation: () => {}, startTimer: () => {},
    authPage: () => {}, window: { scrollTo() {} }
  });
  vm.runInContext(`let navigationState={userId:null,session:'',index:0,end:0},navigationPending=null,navigationRunning=false,navigationLocation='',navigationDrain=null,quizTimer;\n${navigationSource}\n${renderSource}\n${routeSource}`, context);
  context.initializeNavigation();
  return {
    context, ui, history, controls, shell, rendered, selections,
    entry: () => history.state.learnioNavigation,
    snapshot: () => ({ entries: copy(entries), cursor, saved: [...storage] }),
    select: id => store.selectJourney(id),
    setUser: id => { user = profile(id); },
    holdSelection: hook => { selectionHook = hook; },
    peak: () => peak, closed: () => closed,
    async move(delta) { history.go(delta); return context.queueNavigation(); },
    async adopt(hash) { entries.splice(cursor + 1); entries.push({ hash, state: null }); cursor++; setLocation(hash); return context.queueNavigation(); }
  };
}

function buttons(app, back, forward) {
  app.context.updateNavigationControls();
  assert.deepEqual(app.controls.map(control => control.disabled), [back, forward], 'Back/Forward must reflect the available history.');
  const markup = app.context.navigationControls();
  for (const [direction, disabled] of [['back', back], ['forward', forward]]) {
    const button = markup.match(new RegExp(`<button[^>]*data-action="navigation-${direction}"[^>]*>`))[0];
    assert.equal(/\sdisabled(?:\s|>)/.test(button), disabled, 'Rendered controls must agree with updated controls.');
  }
}

const app = browser();
const accountChange = browser();
Object.assign(accountChange.ui,{courseId:'college-course',selectedAssignment:'old-task',selectedSubmission:'old-work',academyEditor:{content:'Previous account draft'},filters:{topic:['Old topic']}});
accountChange.setUser('another-user');accountChange.context.resetAccountView();
assert.equal(accountChange.ui.courseId,'','Changing accounts clears course context.');
assert.equal(accountChange.ui.academyEditor,null,'An authoring draft cannot remain in another account’s view.');
assert.equal(accountChange.ui.selectedSubmission,null);
assert.deepEqual(copy(accountChange.ui.filters),{});
const academicHistory = browser();
Object.assign(academicHistory.ui, { workspace:'institution', institutionId:'northstar', page:'Academic profile', academicYear:'all', academicSemester:'current', academicCourse:'all', academicStatus:'all', academicView:'overview' });
academicHistory.context.writeRoute(true);
Object.assign(academicHistory.ui, { academicSemester:'all', academicView:'grades' });
academicHistory.context.writeRoute();
await academicHistory.move(-1);
assert.equal(academicHistory.ui.academicSemester,'current','Back restores academic filters.');
assert.equal(academicHistory.ui.academicView,'overview','Back restores the academic view.');
await academicHistory.move(1);
assert.equal(academicHistory.ui.academicSemester,'all');
assert.equal(academicHistory.ui.academicView,'grades');
app.context.writeRoute(true);
assert.equal(app.history.length, 1, 'Initialization replaces the current entry.');
buttons(app, true, true);
app.context.writeRoute();
assert.equal(app.history.length, 1, 'Repeated rendering cannot add duplicate visits.');
app.ui.menu = true; app.ui.planDetailed = true;
app.context.writeRoute();
assert.equal(app.history.length, 1, 'Incidental UI state on another page is not a navigation action.');
app.ui.page = 'Calendar';
app.context.writeRoute();
app.ui.month = '2026-11';
app.context.writeRoute();
assert.equal(app.history.length, 3, 'Page changes and month changes are separate visits.');
buttons(app, false, true);
await app.move(-1);
buttons(app, false, false);
assert.equal(app.ui.page, 'Calendar');
assert.equal(app.ui.month, '2026-10', 'Back restores the calendar month.');
await app.move(1);
assert.equal(app.ui.month, '2026-11', 'Forward restores the next calendar month.');
await app.move(-2);
assert.equal(app.ui.page, 'Today');
buttons(app, true, false);
app.ui.page = 'Journey plan';
app.ui.planJourney = 'j1'; app.ui.planWeek = '2026-10-12'; app.ui.planDetailed = true;
app.context.writeRoute();
assert.equal(app.history.length, 2, 'A new action after Back replaces the forward branch.');
buttons(app, false, true);
app.ui.planWeek = '2026-10-19';
app.context.writeRoute();
await app.move(-1);
assert.equal(app.ui.planWeek, '2026-10-12');
assert.equal(app.ui.planDetailed, true, 'Back restores the detailed weekly plan.');

app.ui.page = 'Discover'; app.ui.query = 'Python'; app.ui.filters = { difficulty: ['Beginner'], topic: ['Python'] };
app.context.writeRoute();
app.ui.query = 'Java';
app.context.writeRoute();
await app.move(-1);
assert.equal(app.ui.query, 'Python', 'Back restores discovery search.');
assert.deepEqual(copy(app.ui.filters), { difficulty: ['Beginner'], topic: ['Python'] });
const size = app.history.length;
app.context.writeRoute();
assert.equal(app.history.length, size, 'Restoring a view then rendering keeps the forward branch.');

const refreshed = browser(app.snapshot());
Object.assign(refreshed.ui, refreshed.context.navigationView(refreshed.entry().view));
await refreshed.context.restoreRoute();
refreshed.context.writeRoute(true);
assert.equal(refreshed.ui.query, 'Python', 'Refresh restores the current view.');
assert.equal(refreshed.entry().session, app.entry().session, 'Refresh retains the signed-in navigation session.');
assert.equal(refreshed.history.length, app.history.length, 'Refresh does not append a visit.');
await refreshed.move(1);
assert.equal(refreshed.ui.query, 'Java', 'Refresh retains the forward branch.');

const originalTopics = copy(app.entry().view.filters.topic), previousIndex = app.entry().index;
app.ui.filters.topic.push('Databases');
assert.deepEqual(copy(app.entry().view.filters.topic), originalTopics, 'Editing restored filters cannot mutate the saved visit.');
app.context.writeRoute();
assert.equal(app.entry().index, previousIndex + 1, 'An in-place filter edit creates a separate visit.');
await app.move(-1);
assert.deepEqual(copy(app.ui.filters.topic), ['Python'], 'Back restores the original filters after an in-place edit.');

const refreshedSnapshot = refreshed.entry().view;
Object.assign(refreshed.ui, refreshed.context.navigationView(refreshedSnapshot));
refreshed.ui.filters.topic.push('Java');
assert.deepEqual(copy(refreshedSnapshot.filters.topic), ['Python'], 'Boot detaches nested UI fields before rendering can normalize them.');

const college = browser();
college.context.writeRoute(true);
Object.assign(college.ui, { workspace: 'institution', institutionId: 'northstar', page: 'Calendar', collegeInstitution: 'northstar', collegeMonth: '2026-10' });
college.context.writeRoute();
college.ui.collegeMonth = '2026-11'; college.context.writeRoute();
college.ui.page = 'Overview'; college.ui.courseId = 'college-course'; college.context.writeRoute();
Object.assign(college.ui, { workspace: 'course', page: 'Discussion', courseId: 'public-course' }); college.context.writeRoute();
await college.move(-1);
assert.equal(college.ui.workspace, 'institution', 'Back restores the college workspace.');
assert.equal(college.ui.institutionId, 'northstar');
assert.equal(college.ui.page, 'Overview');
assert.equal(college.ui.courseId, 'college-course', 'Back restores the selected course.');
await college.move(-1);
assert.equal(college.ui.page, 'Schedule', 'Legacy college Calendar routes restore the canonical Schedule page.');
assert.equal(college.ui.courseId, '', 'Returning to the college calendar clears the course context.');
assert.equal(college.ui.collegeMonth, '2026-11');
await college.move(-1);
assert.equal(college.ui.collegeMonth, '2026-10', 'Back restores the college calendar month.');
await college.move(3);
assert.equal(college.ui.workspace, 'course');
assert.equal(college.ui.page, 'Discussion');
assert.equal(college.ui.courseId, 'public-course', 'Forward restores an enrolled public course.');

const noStorage = browser({ storageUnavailable: true });
noStorage.context.writeRoute(true);
noStorage.ui.page = 'Progress'; noStorage.context.writeRoute();
await noStorage.move(-1);
assert.equal(noStorage.ui.page, 'Today', 'Browser history works when session storage is blocked.');
buttons(noStorage, true, false);
await noStorage.move(1);
assert.equal(noStorage.ui.page, 'Progress');
buttons(noStorage, false, true);

const native = browser();
native.context.writeRoute(true);
await native.adopt('#Calendar?journey=j1');
const adopted = native.entry();
await native.context.queueNavigation();
assert.equal(native.history.length, 2);
assert.equal(native.rendered.length, 1, 'popstate and hashchange for the same visit render once.');
assert.ok(adopted.session, 'A native hash visit receives the current navigation scope.');

const oldSession = native.entry().session;
native.setUser('teacher'); native.context.resetNavigation(); native.context.writeRoute(true);
assert.notEqual(native.entry().session, oldSession, 'Changing accounts starts a new navigation session.');
assert.equal(native.entry().userId, 'teacher');
assert.equal(native.entry().index, 0, 'Previous account entries cannot become in-app Back targets.');
native.ui.query = 'Teacher search';
await native.move(-1);
assert.equal(native.ui.query, 'Teacher search', 'Native Back cannot restore another account’s saved view.');
assert.equal(native.entry().userId, 'teacher');
assert.notEqual(native.entry().session, oldSession);
buttons(native, true, true);

const quiz = browser();
quiz.context.writeRoute(true);
quiz.ui.page = 'Quizzes'; quiz.ui.quizId = 'a1'; quiz.context.writeRoute();
quiz.ui.page = 'Today'; quiz.ui.quizId = null; quiz.context.writeRoute();
await quiz.move(-1);
assert.equal(quiz.ui.page, 'Quizzes');
assert.equal(quiz.ui.quizId, 'a1', 'Back restores the quiz attempt without replaying answer writes.');

const rapid = browser();
rapid.context.writeRoute(true);
await rapid.select('j2'); rapid.ui.page = 'Calendar'; rapid.context.writeRoute();
rapid.ui.page = 'Progress'; rapid.context.writeRoute();
rapid.selections.length = 0;
let release;
rapid.holdSelection(id => id === 'j1' ? new Promise(resolve => { release = resolve; }) : Promise.resolve());
const back = rapid.move(-2);
await new Promise(setImmediate);
assert.equal(typeof release, 'function');
buttons(rapid, true, true);
const forward = rapid.move(1);
release();
await Promise.all([back, forward]);
assert.equal(rapid.peak(), 1, 'Journey restoration must serialize server selections.');
assert.deepEqual(rapid.selections, ['j1', 'j2']);
assert.equal(rapid.context.store.getJourney().id, 'j2');
assert.equal(rapid.ui.page, 'Calendar');
assert.deepEqual(rapid.rendered.map(view => view.page), ['Calendar'], 'Only the latest native target renders.');
assert.ok(rapid.closed() > 0, 'History navigation closes stale dialogs.');

const stale = browser();
stale.context.writeRoute(true);
stale.ui.page = 'Calendar'; stale.context.writeRoute();
stale.ui.page = 'Progress'; stale.context.writeRoute();
let finishSelection;
stale.holdSelection(id => id === 'j2' ? new Promise(resolve => { finishSelection = resolve; }) : Promise.resolve());
const ordinarySelection = stale.select('j2').then(() => stale.context.render(true));
await new Promise(setImmediate);
assert.equal(typeof finishSelection, 'function');
const rewind = stale.move(-1);
assert.equal(stale.shell.inert, true, 'History restoration blocks new UI actions while writes drain.');
finishSelection();
await Promise.all([ordinarySelection, rewind]);
assert.deepEqual(stale.selections, ['j2', 'j1'], 'Back waits for the outstanding selection and then restores its target journey.');
assert.equal(stale.context.store.getJourney().id, 'j1');
assert.equal(stale.ui.page, 'Calendar');
assert.deepEqual(stale.rendered.map(view => view.page), ['Calendar'], 'A stale normal callback cannot render over browser Back.');
assert.equal(stale.history.length, 3, 'A stale callback cannot truncate the forward branch.');
assert.equal(stale.shell.inert, false, 'Restoration re-enables the application.');
buttons(stale, false, false);
await stale.move(1);
assert.equal(stale.ui.page, 'Progress', 'The forward visit survives the outstanding write race.');
assert.equal(stale.context.store.getJourney().id, 'j1');

console.log('Navigation checks passed: browser history, view restoration, branching, account scope, and rapid journey navigation.');
