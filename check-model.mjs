import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pbkdf2Sync } from 'node:crypto';
const require = createRequire(import.meta.url);
const { createStore, allocate, DEFAULT_AVAILABILITY, PASSWORD_ITERATIONS } = require('./learning-store.js');
const { QUESTIONS } = require('./server.js');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    fail: false,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (this.fail) throw Error('Storage quota exceeded'); values.set(key, value); }
  };
}
const storage = memoryStorage();
let clock = new Date('2026-09-30T06:00:00Z');
const create = () => createStore({ storage, now: () => clock, seed: true, questions: QUESTIONS });
let store = create();
const ok = result => { assert.equal(result.ok, true, result.error); return result; };
function noOverlap(tasks) {
  const sorted = [...tasks].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].date === sorted[i - 1].date) assert.ok(sorted[i].startTime >= sorted[i - 1].endTime, 'sessions must not overlap');
}

assert.equal(store.getUser(), null, 'the login page is the initial state');
assert.equal((await store.login('riya_learns', 'wrong')).ok, false);
ok(await store.login(' RIYA_LEARNS ', 'demo123'));
assert.equal(store.getUser().username, 'riya_learns');
const dsa = store.getJourney();
const python = store.getJourneys().find(j => j.id !== dsa.id);
assert.ok(dsa.items.length > 1);
assert.ok(store.getTasks(dsa.id, store.today()).length > 0);
const twoSum = dsa.items.find(i => i.title === 'Two Sum');
const beforeCompleted = store.getStats(dsa.id).completed;
const beforeEvidence = store.getEvidence(dsa.id).length;
assert.equal(store.completeItem(python.id, twoSum.id).ok, false, 'an item cannot cross journey boundaries');
assert.equal(store.completeItem(dsa.id, twoSum.id, { url: 'javascript:alert(1)' }).ok, false);
assert.equal(store.completeItem(dsa.id, twoSum.id, { source: 'github' }).ok, false, 'a user cannot fabricate integration provenance');
ok(store.completeItem(dsa.id, twoSum.id, { note: 'Traced the map lookup.', url: 'https://example.test/my-solution' }));
ok(store.completeItem(dsa.id, twoSum.id));
assert.equal(store.getStats(dsa.id).completed, beforeCompleted + 1);
assert.equal(store.getEvidence(dsa.id).length, beforeEvidence + 1, 'duplicate completion has one evidence event');
assert.ok(store.getTasks(dsa.id).filter(t => t.itemId === twoSum.id).every(t => t.status === 'Completed'));
assert.equal(store.getStats(python.id).completed, 1, 'Python completion is unchanged');
const untouched = store.getJourney(dsa.id).items.find(i => !i.completedAt);
assert.equal(store.completeItem(dsa.id, untouched.id, { eventId: 'client-forged-event' }).ok, false, 'a client event ID cannot assert completion without its own evidence');
assert.equal(store.getJourney(dsa.id).items.find(i => i.id === untouched.id).completedAt, null);
store = create();
assert.equal(store.getStats(dsa.id).completed, beforeCompleted + 1, 'completion survives reload');
const immutable = store.getJourney(); immutable.items[0].title = 'mutated';
assert.notEqual(store.getJourney().items[0].title, 'mutated', 'reads cannot bypass transactions');

const attemptId = ok(store.startQuiz({ journeyId: dsa.id, topics: ['Arrays'], difficulty: 'Beginner', minutes: 10 })).attemptId;
assert.equal(store.submitQuiz(attemptId).ok, false, 'empty quiz cannot receive a score');
const attempt = store.getAttempt(attemptId);
assert.equal(attempt.questions.length, 2);
assert.equal(store.startQuiz({ journeyId: dsa.id, topics: ['Arrays'] }).attemptId, attemptId, 'starting resumes the current draft');
assert.equal(store.answerQuiz(attemptId, 'not-a-question', 0).ok, false);
ok(store.answerQuiz(attemptId, attempt.questions[0].id, attempt.questions[0].answer));
store = create();
assert.equal(Object.keys(store.getAttempt(attemptId).answers).length, 1, 'answers survive reload');
const result = ok(store.submitQuiz(attemptId)).attempt.result;
assert.deepEqual([result.correct, result.incorrect, result.skipped, result.total, result.percent], [1, 0, 1, 2, 50]);
ok(store.submitQuiz(attemptId));
assert.equal(store.getStats(dsa.id).attempts, 1, 'duplicate quiz submission is idempotent');
assert.equal(store.getStats(dsa.id).averageScore, 50);
assert.equal(store.getJourney(dsa.id).tasks.length, dsa.tasks.length, 'on-demand quizzes do not allocate calendar work');
assert.equal(store.startQuiz({ journeyId: dsa.id, topics: ['Functions'] }).ok, false, 'uncovered topics are rejected');

const quizItem = ok(store.scheduleQuiz({ journeyId: dsa.id, topics: ['Arrays'], difficulty: 'Beginner', date: store.plusDays(store.today(), 7), startTime: '18:00', minutes: 10 })).itemId;
const fixed = store.getJourney(dsa.id).tasks.find(t => t.itemId === quizItem);
const evidenceTimestamp = store.getEvidence(dsa.id).find(e => e.itemId === twoSum.id).completedAt;
const narrow = { ...store.defaults, weeklyHours: 3.5, days: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, .5])) };
const preview = ok(store.previewSchedule(dsa.id, narrow));
noOverlap(preview.tasks);
ok(store.saveSchedule(dsa.id, narrow));
assert.deepEqual(store.getJourney(dsa.id).tasks.find(t => t.id === fixed.id), fixed, 'fixed sessions retain exact IDs and times');
assert.equal(store.getEvidence(dsa.id).find(e => e.itemId === twoSum.id).completedAt, evidenceTimestamp, 'rescheduling cannot rewrite completed history');
assert.equal(store.rescheduleTask(dsa.id, fixed.id, store.today(), '18:30').ok, false);
assert.equal(store.saveSchedule(dsa.id, { ...narrow, weeklyHours: 10 }).ok, false, 'weekly and daily capacities must agree');

const scheduledAttemptId = ok(store.startQuiz({ journeyId: dsa.id, itemId: quizItem })).attemptId;
const scheduledAttempt = store.getAttempt(scheduledAttemptId);
ok(store.answerQuiz(scheduledAttemptId, scheduledAttempt.questions[0].id, scheduledAttempt.questions[0].answer));
ok(store.submitQuiz(scheduledAttemptId));
assert.ok(store.getJourney(dsa.id).items.find(i => i.id === quizItem).completedAt, 'scheduled submission completes its exact item');
assert.ok(store.getTasks(dsa.id).find(t => t.id === fixed.id).completedAt, 'Calendar reads the same completion');

ok(store.saveDraft({ title: 'Keep this draft', planningMode: 'time-first', contentIds: ['python-course'], availability: narrow }));
store = create();
assert.equal(store.getData().draft.title, 'Keep this draft');
const createdId = ok(store.createJourney({ title: 'My new path', contentIds: ['python-course'] })).journeyId;
assert.equal(store.getJourney(createdId).items.length, 2);
assert.equal(store.getData().draft, null);
assert.equal(ok(store.addContent('python-course', createdId)).added, 0, 'duplicate enrollments do not duplicate units');
assert.equal(ok(store.addContent('array-sheet', createdId)).added, 2);
const adoptedId = ok(store.adoptJourney('dsa-journey')).journeyId;
assert.notEqual(adoptedId, dsa.id, 'a title collision must create a new independent journey');
assert.equal(store.getJourney(adoptedId).sourceVersion.version, 1);
assert.equal(store.getJourney(adoptedId).items.length, 5);
assert.equal(store.getStats(adoptedId).completed, 0, 'adoption copies content, not the publisher’s completion');
const duplicateId = ok(store.duplicateJourney(dsa.id)).journeyId;
assert.equal(store.getStats(duplicateId).completed, 0, 'duplication resets personal progress');

ok(await store.login('asha_teaches', 'demo123'));
assert.equal(store.getUser().educator, true);
assert.equal(store.getJourney(dsa.id), null, 'account reads isolate another owner’s journey');
assert.equal(store.completeItem(dsa.id, twoSum.id).ok, false, 'account writes isolate another owner’s journey');
assert.equal(store.getStats().completed, 1);
assert.equal(store.updateSettings({ username: 'RIYA_LEARNS' }).ok, false, 'username comparison is case insensitive across account capabilities');
assert.equal(store.updateSettings({ username: 'northstar_university' }).ok, false, 'institution usernames share the namespace');
ok(store.updateSettings({ displayName: 'Asha’s learning profile', educator: false }));
assert.equal(store.getJourneys().length, 2, 'educator capability changes retain learning records');
assert.equal(store.getData().memberships[0].role, 'educator', 'account capability changes do not rewrite scoped membership');

const password = 'local-only-strong-pass';
ok(await store.register({ username: 'new_learner', displayName: 'Riya Sharma', email: 'new@example.test', password, educator: true }));
assert.equal(store.getUser().displayName, 'Riya Sharma', 'display names may repeat');
assert.equal(store.getJourneys().length, 0, 'new accounts have a truthful empty learning history');
assert.equal(store.getData().memberships.length, 0, 'registration never grants institution membership');
assert.equal(storage.getItem(store.storageKey).includes(password), false, 'passwords are never persisted in plaintext');
assert.equal('credentials' in store.getUser(), false, 'public account readers omit password hashes');
const registered = JSON.parse(storage.getItem(store.storageKey)).users.find(u => u.username === 'new_learner').credentials;
assert.equal(registered.iterations, 600000, 'new accounts use the current PBKDF2-SHA256 work factor');
assert.match(registered.salt, /^[a-f0-9]{48}$/, 'new salts contain 24 cryptographically random bytes');
assert.equal(registered.hash, pbkdf2Sync(password, registered.salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex'));
ok(store.logout());
store = create();
ok(await store.login('new_learner', password));
assert.equal((await store.login('new_learner', 'incorrect')).ok, false);
assert.equal((await store.register({ username: 'NEW_LEARNER', displayName: 'Different name', email: 'another@example.test', password })).ok, false);

// Existing accounts retain their passwords and learning records while their hashes upgrade atomically.
const legacyState = JSON.parse(storage.getItem(store.storageKey));
legacyState.activeUserId = null;
const legacyUser = legacyState.users.find(u => u.username === 'new_learner');
const legacySalt = 'salt-16c22bcd-aef3-4ae8-8b30-7ed128a10b44';
legacyUser.credentials = { algorithm: 'PBKDF2-SHA256', iterations: 120000, salt: legacySalt, hash: pbkdf2Sync(password, legacySalt, 120000, 32, 'sha256').toString('hex') };
const legacySaved = JSON.stringify(legacyState);
const legacyStorage = memoryStorage({ [store.storageKey]: legacySaved });
let legacyStore = createStore({ storage: legacyStorage });
assert.equal((await legacyStore.login('new_learner', 'incorrect')).ok, false);
assert.equal(legacyStorage.getItem(store.storageKey), legacySaved, 'wrong passwords leave legacy hashes and all saved records unchanged');
legacyStorage.fail = true;
assert.equal((await legacyStore.login('new_learner', password)).ok, false);
assert.equal(legacyStore.getUser(), null, 'a failed hash upgrade cannot establish a login');
assert.equal(legacyStorage.getItem(store.storageKey), legacySaved, 'a failed save rolls back hash upgrades');
legacyStorage.fail = false;
ok(await legacyStore.login(' NEW_LEARNER ', password));
const upgradedState = JSON.parse(legacyStorage.getItem(store.storageKey));
const upgradedCredentials = upgradedState.users.find(u => u.id === legacyUser.id).credentials;
assert.equal(upgradedState.revision, legacyState.revision + 1, 'login and password upgrade use one saved transaction');
assert.equal(upgradedCredentials.iterations, PASSWORD_ITERATIONS);
assert.notEqual(upgradedCredentials.salt, legacySalt, 'hash upgrades generate a fresh salt');
assert.equal(upgradedCredentials.hash, pbkdf2Sync(password, upgradedCredentials.salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex'));
assert.deepEqual(upgradedState.userData, legacyState.userData, 'hash upgrades preserve every learning record');
ok(legacyStore.logout());
legacyStore = createStore({ storage: legacyStorage });
ok(await legacyStore.login('new_learner', password));
assert.deepEqual(JSON.parse(legacyStorage.getItem(store.storageKey)).users.find(u => u.id === legacyUser.id).credentials, upgradedCredentials, 'current hashes survive reload and are not repeatedly rewritten');
for (const invalid of [{ algorithm: 'unknown' }, { iterations: 119999 }, { iterations: PASSWORD_ITERATIONS + 1 }, { iterations: '120000' }, { iterations: 120000.5 }, { salt: '' }, { salt: 'x'.repeat(129) }, { hash: 'invalid' }]) {
  const unsupported = structuredClone(legacyState);
  Object.assign(unsupported.users.find(u => u.id === legacyUser.id).credentials, invalid);
  const saved = JSON.stringify(unsupported);
  const isolated = memoryStorage({ [store.storageKey]: saved });
  const rejected = await createStore({ storage: isolated }).login('new_learner', password);
  assert.equal(rejected.ok, false, 'unsupported password metadata fails closed');
  assert.equal(rejected.error, 'Username or password is incorrect.');
  assert.equal(isolated.getItem(store.storageKey), saved, 'rejected metadata never changes persisted credentials');
}

const beforeFailure = store.getState();
storage.fail = true;
assert.equal(store.createJourney({ title: 'Not really saved' }).ok, false);
assert.deepEqual(store.getState(), beforeFailure, 'storage failures roll back every domain mutation');
storage.fail = false;
const stale = create();
ok(store.saveDraft({ title: 'Newest draft' }));
assert.equal(stale.saveDraft({ title: 'Overwrite newer data' }).ok, false, 'stale tabs do not overwrite a newer revision');
const corruptedStorage = memoryStorage({ [store.storageKey]: '{broken' });
const corrupted = createStore({ storage: corruptedStorage });
assert.equal(corrupted.getPersistence().available, false);
assert.equal((await corrupted.login('riya_learns', 'demo123')).ok, false);
assert.equal(corruptedStorage.getItem(store.storageKey), '{broken', 'corrupt data is preserved for recovery');

// A multi-session lesson checks the allocator’s actual intervals, fixed-time preservation, and capacity bounds.
const spanning = { startDate: '2026-10-01', items: [{ id: 'long', duration: 155 }, { id: 'fixed', duration: 20 }], tasks: [{ id: 'fixed-time', itemId: 'fixed', date: '2026-10-01', startTime: '18:15', endTime: '18:35', minutes: 20, fixed: true, completedAt: null }] };
const availability = { ...DEFAULT_AVAILABILITY, weeklyHours: 7, days: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, 1])) };
const allocated = allocate(spanning, availability, '2026-10-01');
noOverlap(allocated.tasks);
assert.equal(allocated.tasks.filter(t => t.itemId === 'long').reduce((n, t) => n + t.minutes, 0), 155);
assert.deepEqual(allocated.tasks.find(t => t.id === 'fixed-time'), { ...spanning.tasks[0], timezone: availability.timezone });
for (const date of new Set(allocated.tasks.map(t => t.date))) assert.ok(allocated.tasks.filter(t => t.date === date).reduce((n, t) => n + t.minutes, 0) <= 60);
assert.equal(allocated.unscheduled.length, 0);
assert.ok(allocated.tasks.filter(t => t.itemId === 'long').length > 1, 'long modules are split into real daily slices');

// The activity calendar uses actual saved events, including portions completed in a different year from their final module.
const activityStorage = memoryStorage();
let activityClock = new Date('2023-12-31T12:00:00Z');
const activityReader = () => createStore({ storage: activityStorage, now: () => activityClock, seed: true, questions: QUESTIONS });
let activityStore = activityReader();
ok(await activityStore.login('riya_learns', 'demo123'));
ok(activityStore.updateSettings({ timezone: 'UTC' }));
assert.equal(activityStore.getActivityYear(2023).totalEvents, 0, 'seeded Sample completion is not real learner activity');
assert.equal(activityStore.getActivityYear(2023).excludedSampleEvents, 1);
const activityJourneyId = ok(activityStore.createJourney({ title: 'Yearly activity check', contentIds: ['dsa-course'], availability: { ...narrow, timezone: 'UTC' } })).journeyId;
let activityJourney = activityStore.getJourney(activityJourneyId);
const arrayItem = activityJourney.items.find(i => i.topic === 'Arrays');
const hashItem = activityJourney.items.find(i => i.topic === 'Hash maps');
const arraySlice = activityJourney.tasks.find(t => t.itemId === arrayItem.id);
assert.equal(arraySlice.minutes, 30);
ok(activityStore.completeTask(activityJourneyId, arraySlice.id));
assert.equal(activityStore.getActivityYear(2023).totalMinutes, 30);
activityClock = new Date('2024-01-01T00:10:00Z');
ok(activityStore.completeItem(activityJourneyId, arrayItem.id));
let calendar = activityStore.getActivityYear(2024);
assert.equal(calendar.totalEvents, 1);
assert.equal(calendar.totalMinutes, 5, 'the new year receives only the remaining module workload, not the previous year’s slice');
const hashSlice = activityJourney.tasks.find(t => t.itemId === hashItem.id);
ok(activityStore.completeTask(activityJourneyId, hashSlice.id));
ok(activityStore.completeItem(activityJourneyId, hashItem.id));
calendar = activityStore.getActivityYear(2024);
assert.equal(calendar.totalEvents, 3, 'a slice and the later remaining module are two real learning events');
assert.equal(calendar.totalMinutes, 50, 'same-timestamp slice/full completion follows saved event order without counting a task twice');
assert.equal(calendar.days.length, 366);
assert.equal(calendar.days[0].date, '2024-01-01');
assert.equal(calendar.days.at(-1).date, '2024-12-31');
assert.equal(calendar.days.find(d => d.date === '2024-01-01').level, 2);
assert.equal(calendar.days.find(d => d.date === '2024-02-29').count, 0);
assert.equal(calendar.days.find(d => d.date === '2024-02-29').future, true);
assert.deepEqual(calendar.availableYears, [2024, 2023]);
assert.equal(calendar.totalPlannedMinutes, 50, 'planned workload follows saved allocations, independently of completion time');
assert.equal(calendar.days.find(d => d.date === '2024-01-01').plannedMinutes, 30);
assert.equal(calendar.days.find(d => d.date === '2024-01-01').minutes, 50, 'actual completed workload can exceed that day’s planned workload');

const activityQuizItem = ok(activityStore.scheduleQuiz({ journeyId: activityJourneyId, topics: ['Arrays'], difficulty: 'Beginner', date: '2024-01-05', startTime: '00:15', minutes: 10 })).itemId;
const submitActivityQuiz = itemId => {
  const attemptId = ok(activityStore.startQuiz({ journeyId: activityJourneyId, ...(itemId ? { itemId } : { topics: ['Arrays'], difficulty: 'Beginner', minutes: 10 }) })).attemptId;
  const a = activityStore.getAttempt(attemptId);
  ok(activityStore.answerQuiz(a.id, a.questions[0].id, a.questions[0].answer));
  ok(activityStore.submitQuiz(a.id));
  return a.id;
};
const scheduledActivityAttempt = submitActivityQuiz(activityQuizItem);
submitActivityQuiz();
submitActivityQuiz();
calendar = activityStore.getActivityYear(2024);
assert.equal(calendar.totalEvents, 6, 'a scheduled attempt and its evidence count once; on-demand attempts still count');
assert.equal(calendar.totalMinutes, 60, 'scheduled quiz workload is credited once and optional quizzes invent no workload minutes');
assert.equal(calendar.days[0].level, 4);
assert.equal(calendar.minutesKind, 'estimated-workload');

const activitySaved = JSON.parse(activityStorage.getItem(activityStore.storageKey));
const activeData = activitySaved.userData.riya;
activeData.evidence.push(structuredClone(activeData.evidence.find(e => e.itemId === hashItem.id && e.taskId)));
activeData.attempts.push(structuredClone(activeData.attempts.find(a => a.id === scheduledActivityAttempt)));
activityStorage.setItem(activityStore.storageKey, JSON.stringify(activitySaved));
activityStore = activityReader();
assert.equal(activityStore.getActivityYear(2024).totalEvents, 6, 'duplicate task-source and attempt records do not inflate activity');
assert.equal(activityStore.getActivityYear(2024).totalMinutes, 60);
const beforeActivityRead = activityStorage.getItem(activityStore.storageKey);
activityStore.getActivityYear('2024');
assert.equal(activityStorage.getItem(activityStore.storageKey), beforeActivityRead, 'the synchronous calendar reader does not mutate persisted records');

ok(activityStore.reopenItem(activityJourneyId, arrayItem.id));
assert.equal(activityStore.getActivityYear(2023).totalEvents, 0, 'reopening removes corrected task-completion events from their original year');
assert.equal(activityStore.getActivityYear(2024).totalMinutes, 55);
ok(activityStore.reopenItem(activityJourneyId, activityQuizItem));
assert.equal(activityStore.getActivityYear(2024).totalMinutes, 45, 'reopened quiz completion no longer claims completed workload');
assert.equal(activityStore.getActivityYear(2024).totalEvents, 5, 'actual submitted quiz history remains an activity event after a plan correction');
ok(activityStore.reopenItem(activityJourneyId, hashItem.id));
assert.equal(activityStore.getActivityYear(2024).totalEvents, 3, 'all corrected module sources, including duplicate evidence, are excluded');
assert.equal(activityStore.getActivityYear(2024).totalMinutes, 0);
ok(activityStore.updateSettings({ timezone: 'America/Los_Angeles' }));
assert.equal(activityStore.getActivityYear(2023).days.at(-1).count, 3, 'event timestamps use the account timezone across year boundaries');
assert.equal(activityStore.getActivityYear(2024).days.find(d => d.date === '2024-01-04').plannedMinutes, 10, 'planned starts convert from the task timezone into the account timezone');
assert.equal(activityStore.getActivityYear(2024).days.find(d => d.date === '2024-01-05').plannedMinutes, 0);

ok(activityStore.updateSettings({ timezone: 'UTC' }));
activityClock = new Date('2024-02-29T12:00:00Z');
ok(activityStore.completeItem(activityJourneyId, arrayItem.id));
submitActivityQuiz();
calendar = activityStore.getActivityYear(2024);
assert.equal(calendar.days.find(d => d.date === '2024-02-29').count, 2, 'leap-day activity is represented explicitly');
assert.equal(calendar.days.find(d => d.date === '2024-02-29').minutes, 35, 'a fresh completion after correction has its own current workload estimate');
assert.equal(calendar.days.find(d => d.date === '2024-03-01').future, true);
const futureData = JSON.parse(activityStorage.getItem(activityStore.storageKey));
const futureAttempt = structuredClone(futureData.userData.riya.attempts.at(-1));
futureAttempt.id = 'future-attempt'; futureAttempt.submittedAt = '2024-03-01T12:00:00Z';
futureData.userData.riya.attempts.push(futureAttempt);
futureData.userData.riya.journeys.find(j => j.id === activityJourneyId).tasks.push({ id: 'dst-gap', itemId: arrayItem.id, date: '2024-03-10', startTime: '02:30', timezone: 'America/New_York', minutes: 15 });
activityStorage.setItem(activityStore.storageKey, JSON.stringify(futureData));
activityStore = activityReader();
assert.equal(activityStore.getActivityYear(2024).totalEvents, calendar.totalEvents, 'future-dated records never paint future activity');
assert.equal(activityStore.getActivityYear(2024).unresolvedPlannedMinutes, 15, 'an impossible DST wall time is reported, not assigned an invented instant');
assert.equal(activityStore.getActivityYear(2024).warnings.length, 1);
assert.equal(activityStore.getActivityYear(1900).days.length, 365);
assert.equal(activityStore.getActivityYear(2000).days.length, 366);
for (const invalidYear of [999, 10000, 2024.5, 'invalid', Infinity]) assert.throws(() => activityStore.getActivityYear(invalidYear), /whole calendar year/);
const untouchedJourneyId = activityStore.getJourneys().find(j => j.id !== activityJourneyId).id;
assert.equal(activityStore.getActivityYear(2024, untouchedJourneyId).totalEvents, 0, 'another journey does not inherit activity');
ok(await activityStore.login('asha_teaches', 'demo123'));
assert.equal(activityStore.getActivityYear(2024, activityJourneyId).totalEvents, 0, 'another account cannot read activity by guessing a journey ID');
assert.equal(activityStore.getActivityYear(2024, activityJourneyId).journeyId, null);

console.log('Learnio model checks passed: persistence, scoped identities, exact evidence, quiz scoring, drafts, adoption, scheduling, failure rollback, and stale-tab protection.');
console.log('Password checks passed: 600,000-round registration, metadata bounds, legacy verification, atomic hash upgrades, wrong-password preservation, and reload compatibility.');
console.log('Yearly activity checks passed: full-year dates, source deduplication, slice reconciliation, corrections, quiz history, timezone boundaries, planned workload, leap years, and account isolation.');
