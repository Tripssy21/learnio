import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const { createStore } = createRequire(import.meta.url)('./learning-store.js');
const source = await readFile(new URL('./api-store.js', import.meta.url), 'utf8');
const snapshot = {
  version: 1, revision: 1, activeUserId: 'learner', reservedUsernames: [],
  users: [{ id: 'learner', username: 'learner', displayName: 'Learner', email: 'learner@example.test', timezone: 'UTC', educator: false }],
  userData: { learner: { selectedJourneyId: null, journeys: [], attempts: [], evidence: [], enrollments: [], memberships: [], draft: null } }
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function browser(fetch) {
  const nodes = new Map();
  const document = {
    body: { prepend() {} }, getElementById: id => nodes.get(id) || null,
    createElement() {
      const node = { style: {}, setAttribute() {}, addEventListener() {}, append() {}, remove() { nodes.delete(node.id); } };
      Object.defineProperty(node, 'id', { get() { return node._id; }, set(value) { node._id = value; nodes.set(value, node); } });
      return node;
    }
  };
  const context = { document, fetch, structuredClone, setTimeout, clearTimeout, AbortController, LearnioDomain: { createStore }, location: { reload() {} } };
  context.window = context;
  vm.runInNewContext(source, context);
  return { context, nodes };
}

const calls = [], pending = [];
const { context, nodes } = browser(async (path, options) => {
  calls.push({ path, options });
  if (path === '/api/session') return { ok: true, json: async () => ({ ok: true, snapshot, catalogue: [{ id: 'server-course' }], defaults: { weeklyHours: 5 }, academy: { courses: [] } }) };
  return new Promise((resolve, reject) => pending.push({ resolve, reject }));
});
assert.equal((await context.learnioReady).ok, true);
const store = context.LearnioStore;
assert.equal(store.getUser().username, 'learner');
assert.equal(store.catalogue[0].id, 'server-course');
assert.equal(store.defaults.weeklyHours, 5);
assert.equal(store.getWorkspace().courses.length, 0);
assert.equal(store.questions.length, 0, 'The adapter must not expose a question bank');
const readActivity = store.getActivityYear;
const emptyActivity = readActivity(2024);
assert.equal(emptyActivity.then, undefined, 'Activity is a synchronous snapshot reader');
assert.equal(emptyActivity.days.length, 366);
assert.equal(emptyActivity.totalEvents, 0);
assert.equal(calls.length, 1, 'Activity reads must not call the mutation API');

const first = store.answerQuiz('attempt', 'question', 0);
const second = store.answerQuiz('attempt', 'question', 1);
let idle = false;
const barrier = store.whenIdle().then(() => { idle = true; });
await tick();
assert.equal(calls.length, 2, 'Rapid answers must not issue simultaneous writes');
assert.equal(idle, false, 'The read barrier must wait for queued answers');
assert.deepEqual(JSON.parse(calls[1].options.body), { action: 'answerQuiz', args: ['attempt', 'question', 0] });
assert.equal(calls[1].options.credentials, 'same-origin');
const completedAt = '2024-02-29T12:00:00Z';
const journey = { id: 'journey', ownerId: 'learner', title: 'Learning path', status: 'active', availability: { timezone: 'UTC' }, items: [{ id: 'item', ownerId: 'learner', journeyId: 'journey', type: 'lesson', duration: 30, completedAt }], tasks: [{ id: 'task', itemId: 'item', minutes: 30, completedAt }] };
const next = { ...snapshot, revision: 2, userData: { learner: { ...snapshot.userData.learner, selectedJourneyId: journey.id, journeys: [journey], evidence: [{ id: 'evidence', ownerId: 'learner', journeyId: journey.id, itemId: 'item', taskId: 'task', source: 'module', completedAt }] } } };
pending.shift().resolve({ ok: true, json: async () => ({ ok: true, snapshot: next, catalogue: [{ id: 'new-server-course' }] }) });
assert.equal((await first).ok, true);
const activity = readActivity(2024, journey.id);
assert.equal(activity.totalEvents, 1, 'A cached reader must use the latest server snapshot');
assert.equal(activity.days.find(day => day.date === '2024-02-29').count, 1);
assert.equal(activity.totalMinutes, 30);
await tick();
assert.equal(calls.length, 3);
assert.equal(idle, false, 'The read barrier must include the second queued answer');
assert.deepEqual(JSON.parse(calls[2].options.body).args, ['attempt', 'question', 1]);
pending.shift().resolve({ ok: false, json: async () => ({ ok: false, error: 'Answer rejected' }) });
assert.equal((await second).error, 'Answer rejected');
await barrier;
assert.equal(idle, true);
assert.equal(calls.length, 3, 'The read barrier must not make an HTTP request');
assert.equal(store.getState().revision, 2, 'Rejected writes must preserve the confirmed snapshot');
assert.equal(store.catalogue[0].id, 'new-server-course');

const workspace = store.workspace('createCourse', { title: 'A course' });
await tick();
assert.deepEqual(JSON.parse(calls.at(-1).options.body), { action: 'workspace', args: ['createCourse', { title: 'A course' }] });
pending.shift().resolve({ ok: true, json: async () => ({ ok: true, snapshot: { ...snapshot, revision: 3 }, academy: { courses: [{ id: 'course' }] } }) });
assert.equal((await workspace).ok, true);
assert.equal(store.getWorkspace().courses[0].id, 'course');

const interrupted = store.createJourney({ title: 'A new path' });
await tick();
pending.shift().reject(Error('Connection lost after sending the write'));
assert.equal((await interrupted).uncertain, true);
const requestCount = calls.length;
assert.equal((await store.createJourney({ title: 'A new path' })).ok, false);
assert.equal(calls.length, requestCount, 'An unknown write outcome requires reconciliation, never automatic retry');
assert.equal(store.getState().revision, 3);
assert.equal(context.LearnioStore, store, 'The store reference must remain stable across snapshots');
assert.ok(nodes.has('connection-status'));
assert.match(nodes.get('connection-error-text').textContent, /may have been saved/);

const failed = browser(async () => { throw Error('Offline'); });
assert.equal((await failed.context.learnioReady).ok, false);
assert.equal(failed.context.LearnioStore.getPersistence().available, false);
assert.throws(() => failed.context.LearnioStore.getUser(), /Wait for Learnio/);
assert.equal((await failed.context.LearnioStore.login('learner', 'password')).ok, false);
assert.ok(failed.nodes.has('connection-status'), 'Startup failures must be visible without offline seed data');

let expiredCalls = 0;
const expired = browser(async path => {
  expiredCalls++;
  return path === '/api/session'
    ? { ok: true, json: async () => ({ ok: true, snapshot }) }
    : { ok: false, status: 401, json: async () => ({ ok: false, error: 'Your session has ended. Sign in again.' }) };
});
await expired.context.learnioReady;
assert.equal((await expired.context.LearnioStore.saveNote('journey', 'item', 'note')).ok, false);
assert.match(expired.nodes.get('connection-error-text').textContent, /Reload records to sign in/);
assert.equal((await expired.context.LearnioStore.saveNote('journey', 'item', 'note')).ok, false);
assert.equal(expiredCalls, 2, 'An expired session must not continue queued mutations');

console.log('API adapter checks passed: server snapshots, synchronous yearly activity, serialized writes, workspace actions, session expiry, error retention, and no offline fallback or ambiguous retry.');
