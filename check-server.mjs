import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase, cleanDatabase, TEST_DATA_TAG } from './scripts/test-data.mjs';

const require = createRequire(import.meta.url);
const { createApplication, readState, parseOptions } = require('./server.js');
const CSV = require('./csv.js');
assert.deepEqual(CSV.parse('\uFEFFusername,notes\r\nriya,"A comma, a line\nbreak and ""quotes"""\r\n'), [['username', 'notes'], ['riya', 'A comma, a line\nbreak and "quotes"']]);
assert.throws(() => CSV.parse('name\n"unclosed'), /not closed/);
assert.throws(() => CSV.parse('name\n"closed"suffix'), /Unexpected text/);
assert.deepEqual(CSV.parse(CSV.stringify([['plain', 'a,b', '"quoted"', 'two\nlines']])), [['plain', 'a,b', '"quoted"', 'two\nlines']]);
assert.deepEqual(CSV.parse(CSV.stringify([['=SUM(A1)', ' +formula', '@command', -2]])), [["'=SUM(A1)", "' +formula", "'@command", '-2']], 'CSV exports neutralize formula-like text');
const root = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoot = path.join(root, 'tmp');
mkdirSync(temporaryRoot, { recursive: true });
const directory = mkdtempSync(path.join(temporaryRoot, 'server-check-'));
const dbPath = path.join(directory, 'test.sqlite');
let app, base, previewProcess, passed = false;
async function start() {
  app = createApplication({ dbPath });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  base = 'http://127.0.0.1:' + app.server.address().port;
}
function client() {
  return {
    cookie: '',
    async request(route = '/api/session', body, options = {}) {
      const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...options.headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const cookie = response.headers.get('set-cookie');
      if (cookie) this.cookie = cookie.split(';')[0];
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      return { status: response.status, data, headers: response.headers };
    },
    act(action, ...args) { return this.request('/api/action', { action, args }); }
  };
}
function ok(response) { assert.equal(response.status, 200, JSON.stringify(response.data)); assert.equal(response.data.ok, true); return response.data; }
function current(snapshot) { return snapshot.userData[snapshot.activeUserId]; }
try {
  const savedEnvironment = { ...process.env };
  try {
    delete process.env.PUBLIC_ORIGIN;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.HOST;
    assert.equal(parseOptions([]).publicOrigin, '');
    assert.equal(parseOptions([]).host, '127.0.0.1');
    process.env.RENDER_EXTERNAL_URL = 'https://learnio.onrender.com';
    process.env.HOST = '0.0.0.0';
    assert.equal(parseOptions([]).publicOrigin, process.env.RENDER_EXTERNAL_URL);
    assert.equal(parseOptions([]).host, '0.0.0.0');
    process.env.PUBLIC_ORIGIN = 'https://learnio.example';
    assert.equal(parseOptions([]).publicOrigin, process.env.PUBLIC_ORIGIN, 'an explicit public origin overrides the Render URL');
  } finally {
    for (const key of ['PUBLIC_ORIGIN', 'RENDER_EXTERNAL_URL', 'HOST']) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
  }
  for (const publicOrigin of ['http://learnio.example', 'https://user:pass@learnio.example', 'https://learnio.example/path', 'https://learnio.example/?q=1', 'https://learnio.example/#fragment']) {
    assert.throws(() => createApplication({ dbPath, publicOrigin }), /PUBLIC_ORIGIN/);
  }
  app = createApplication({ dbPath: path.join(directory, 'hosted.sqlite'), publicOrigin: 'https://learnio.example' });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const hostedRequest = (route, body, headers = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: app.server.address().port, path: route, method: body ? 'POST' : 'GET', headers: { Host: 'learnio.example', ...(body ? { Origin: 'https://learnio.example', 'Content-Type': 'application/json' } : {}), ...headers } }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, data: JSON.parse(text) }));
    });
    request.on('error', reject);
    request.end(body ? JSON.stringify(body) : undefined);
  });
  assert.equal((await hostedRequest('/api/health')).status, 200);
  assert.equal((await hostedRequest('/api/session')).data.ok, true);
  assert.equal((await hostedRequest('/api/health', null, { Host: 'attacker.example', 'X-Forwarded-Host': 'learnio.example' })).status, 403);
  const hostedLogin = { action: 'login', args: ['missing-user', 'incorrect-password'] };
  assert.equal((await hostedRequest('/api/action', hostedLogin, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await hostedRequest('/api/action', hostedLogin, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await hostedRequest('/api/action', hostedLogin, { Origin: 'http://learnio.example', 'X-Forwarded-Proto': 'https' })).status, 403);
  const hostedRegistration = await hostedRequest('/api/action', { action: 'register', args: [{ username: 'hosted_learner', displayName: 'Hosted Learner', email: 'hosted@example.test', password: 'hosted-test-password' }] });
  assert.equal(hostedRegistration.status, 200);
  const hostedCookie = hostedRegistration.headers['set-cookie'][0];
  assert.match(hostedCookie, /; Secure$/);
  assert.match(hostedCookie, /; HttpOnly; SameSite=Strict;/);
  assert.equal((await hostedRequest('/api/session', null, { Cookie: hostedCookie.split(';')[0] })).data.snapshot.activeUserId, hostedRegistration.data.snapshot.activeUserId);
  const hostedLogout = await hostedRequest('/api/action', { action: 'logout', args: [] }, { Cookie: hostedCookie.split(';')[0] });
  assert.match(hostedLogout.headers['set-cookie'][0], /Max-Age=0; Secure$/);
  await app.close();
  app = null;
  await start();
  assert.equal((await hostedRequest('/api/health')).status, 403, 'local mode rejects public host headers');
  const planScript = await fetch(base + '/journey-plan.js');
  assert.equal(planScript.status, 200, 'the checkpoint helper is served to the browser');
  assert.match(await planScript.text(), /LearnioPlan/);
  const anonymous = client(), real = client(), other = client();
  assert.equal(ok(await anonymous.request()).snapshot.users.length, 0, 'a fresh server does not seed test credentials');
  assert.equal((await anonymous.act('createJourney', { title: 'forged' })).status, 401);
  assert.equal((await anonymous.act('getState')).status, 400);
  assert.equal((await anonymous.act('login', 'riya_learns', 'demo123')).status, 401, 'test credentials do not exist until seeded');
  assert.equal((await anonymous.request('/api/action', { action: 'register', args: [{}] }, { headers: { Origin: 'https://attacker.example' } })).status, 403);
  for (const route of ['/server.js', '/data/learnio.sqlite', '/data/learnio.sqlite.backup.json', '/scripts/test-data.mjs', '/academy.js', '/tmp/preview.cjs', '/tmp/_archive/preview-before-security-20261007.txt']) assert.equal((await anonymous.request(route)).status, 404, 'private server paths cannot be fetched');
  const account = ok(await real.act('register', { username: 'real_learner', displayName: 'Real Learner', email: 'real@example.test', password: 'real-test-password', educator: true }));
  const realId = account.snapshot.activeUserId;
  assert.equal(account.snapshot.users.length, 1);
  assert.equal(account.snapshot.users[0].credentials, undefined);
  assert.match(real.cookie, /^learnio_session=[a-f0-9]{64}$/);
  const savedSession = app.db.prepare('SELECT * FROM sessions').get();
  assert.notEqual(savedSession.token_hash, real.cookie.split('=')[1], 'only token hashes are stored');
  assert.equal(readState(app.db).activeUserId, null, 'session identity never becomes global application state');
  assert.equal(JSON.stringify(readState(app.db)).includes('real-test-password'), false, 'passwords are not plaintext');
  const duplicate = await other.act('register', { username: 'REAL_LEARNER', displayName: 'Another person', email: 'another@example.test', password: 'another-pass' });
  assert.equal(duplicate.status, 400);
  ok(await other.act('register', { username: 'other_learner', displayName: 'Other Learner', email: 'other@example.test', password: 'another-pass' }));
  const created = ok(await real.act('createJourney', { title: 'A real saved plan', contentIds: ['dsa-course'] }));
  const journeyId = created.journeyId, realData = current(created.snapshot), firstItem = realData.journeys[0].items[0];
  assert.equal(realData.enrollments.length, 1, 'new journey enrollment is atomic');
  assert.equal((await other.act('completeItem', journeyId, firstItem.id)).status, 400, 'forged journey and item IDs cannot cross an account boundary');
  assert.equal((await real.act('completeItem', journeyId, firstItem.id, { source: 'quiz' })).status, 400, 'client cannot forge scored evidence');
  const completed = ok(await real.act('completeItem', journeyId, firstItem.id));
  assert.equal(current(completed.snapshot).evidence.length, 1);
  ok(await real.act('completeItem', journeyId, firstItem.id));
  assert.equal(current(ok(await real.request()).snapshot).evidence.length, 1);
  assert.equal(current(ok(await other.request()).snapshot).journeys.length, 0);
  const quiz = ok(await real.act('startQuiz', { journeyId, topics: ['Arrays'], difficulty: 'Beginner', minutes: 10 }));
  const attempt = current(quiz.snapshot).attempts[0];
  assert.equal(attempt.questions[0].answer, undefined);
  assert.equal(attempt.questions[0].explanation, undefined, 'answers and explanations stay on the server before submission');
  assert.equal((await real.act('submitQuiz', quiz.attemptId)).status, 400);
  ok(await real.act('answerQuiz', quiz.attemptId, attempt.questions[0].id, 0));
  const submitted = ok(await real.act('submitQuiz', quiz.attemptId));
  assert.equal(submitted.attempt.result.percent, 50);
  assert.equal(submitted.attempt.result.skipped, 1);
  assert.equal(submitted.attempt.questions[0].answer, 0, 'submitted review reveals the stored answer key');
  assert.equal((await other.act('answerQuiz', quiz.attemptId, attempt.questions[0].id, 1)).status, 400);
  ok(await real.act('updateJourney', journeyId, { status: 'paused' }));
  assert.equal((await real.act('saveNote', journeyId, firstItem.id, 'Blocked')).status, 400);
  ok(await real.act('updateJourney', journeyId, { status: 'active' }));
  const personalBeforeSeed = structuredClone(current(ok(await real.request()).snapshot));
  const planCsv = 'type,title,topic,minutes,url\r\nlesson,"Read arrays, carefully",Arrays,35,https://example.test/arrays\r\nproblem,Practice a scan,Arrays,20,https://example.test/problem';
  const beforePreviewRevision = readState(app.db).revision;
  const planPreview = ok(await real.act('previewPlanImport', { title: 'Imported personal path', csv: planCsv }));
  assert.equal(planPreview.errors.length, 0);
  assert.equal(planPreview.totalMinutes, 55);
  assert.ok(planPreview.finishDate);
  assert.equal(readState(app.db).revision, beforePreviewRevision, 'plan previews never save learning records');
  const importedPlan = ok(await real.act('importPlanCsv', { title: 'Imported personal path', csv: planCsv }));
  const importedJourney = current(importedPlan.snapshot).journeys.find(j => j.id === importedPlan.journeyId);
  assert.equal(importedJourney.items.length, 2);
  assert.ok(importedJourney.items.every(item => item.completedAt === null), 'CSV cannot fabricate completed work');
  const retryPlan = ok(await real.act('importPlanCsv', { title: ' Imported personal path ', csv: planCsv.replaceAll('\r\n', '\n') }));
  assert.equal(retryPlan.journeyId, importedPlan.journeyId);
  assert.equal(retryPlan.alreadyImported, true, 'normalized plan retry reuses the saved journey');
  const futureDate = new Date(Date.now() + 172800000).toISOString().slice(0, 10);
  const fixedCsv = CSV.stringify([['type', 'title', 'topic', 'minutes', 'url', 'date', 'startTime', 'fixed'], ['review', 'Fixed review', 'Arrays', 20, '', futureDate, '20:00', 'true']]);
  const fixedPreview = ok(await real.act('previewPlanImport', { title: 'Fixed session preview', csv: fixedCsv }));
  assert.ok(fixedPreview.warnings.length, 'fixed sessions outside preferences surface a visible planning warning');
  const overlappingCsv = fixedCsv + '\r\nreview,Overlapping review,Arrays,10,,' + futureDate + ',20:10,true';
  assert.equal((await real.act('previewPlanImport', { title: 'Conflicting sessions', csv: overlappingCsv })).status, 400);
  const invalidPlanCsv = 'type,title,topic,minutes,url\nlesson,Unsafe link,Arrays,20,javascript:alert(1)';
  assert.equal(ok(await real.act('previewPlanImport', { title: 'Invalid import', csv: invalidPlanCsv })).errors.length, 1);
  assert.equal((await real.act('importPlanCsv', { title: 'Invalid import', csv: invalidPlanCsv })).status, 400);

  const firstSeed = await seedDatabase(dbPath);
  assert.equal(firstSeed.accountsCreated, 3);
  const secondSeed = await seedDatabase(dbPath);
  assert.equal(secondSeed.accountsCreated, 0);
  assert.equal(secondSeed.recordsCreated, 0, 'seed is idempotent');
  const student = client(), teacher = client(), admin = client();
  for (const [actor, username] of [[student, 'riya_learns'], [teacher, 'asha_teaches'], [admin, 'northstar_admin']]) {
    const login = await actor.act('login', username, 'demo123');
    const payload = ok(login);
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal(payload.snapshot.users[0].testDataTag, TEST_DATA_TAG);
    assert.equal(payload.snapshot.users.length, 1);
    assert.equal(Object.keys(payload.snapshot.userData).length, 1);
    assert.equal(readState(app.db).users.find(u => u.username === username).demo, false, 'fixtures authenticate using a real password hash');
  }
  assert.equal((await other.act('workspace', 'post', { courseId: 'cs-201', body: 'Forged course post' })).status, 400);
  const importCsv = 'username,courseId,role\r\nother_learner,cs-201,student\r\nasha_teaches,cs-201,educator';
  assert.equal((await other.act('previewEnrollmentImport', { institutionId: 'northstar', csv: importCsv })).status, 400, 'only institution admins can preview identity allocations');
  const preview = ok(await admin.act('previewEnrollmentImport', { institutionId: 'northstar', csv: importCsv }));
  assert.equal(preview.newCount, 1);
  assert.equal(preview.existingCount, 1);
  assert.equal(preview.errors.length, 0);
  const beforeBadImport = readState(app.db);
  const badCsv = importCsv + '\r\nreal_learner,cs-201,administrator';
  assert.equal(ok(await admin.act('previewEnrollmentImport', { institutionId: 'northstar', csv: badCsv })).errors.length, 1);
  assert.equal((await admin.act('importEnrollments', { institutionId: 'northstar', csv: badCsv })).status, 400);
  assert.deepEqual(readState(app.db), beforeBadImport, 'an invalid row prevents the complete CSV batch from committing');
  assert.equal(ok(await admin.act('previewEnrollmentImport', { institutionId: 'northstar', csv: importCsv + '\r\nOTHER_LEARNER,cs-201,student' })).errors.length, 1, 'normalized duplicate rows are rejected');
  assert.equal((await admin.act('previewEnrollmentImport', { institutionId: 'northstar', csv: 'username,courseId,role\n"unclosed' })).status, 400);
  assert.equal(ok(await admin.act('importEnrollments', { institutionId: 'northstar', csv: importCsv })).imported, 1);
  const repeatedImport = ok(await admin.act('importEnrollments', { institutionId: 'northstar', csv: importCsv }));
  assert.deepEqual([repeatedImport.imported, repeatedImport.skipped], [0, 2], 'an import retry cannot duplicate allocations');
  assert.equal((await other.act('exportEnrollments', { institutionId: 'northstar' })).status, 400, 'learners cannot export a course roster');
  const exported = ok(await admin.act('exportEnrollments', { institutionId: 'northstar' }));
  assert.deepEqual(exported.rows[0], ['username', 'displayName', 'courseId', 'courseTitle', 'role']);
  assert.ok(exported.rows.slice(1).every(row => row[2] === 'cs-201'));
  assert.ok(exported.academy.audit.some(event => event.action === 'exportEnrollments' && event.rowCount === exported.exported), 'the server records export scope before returning rows');
  const exportedCsv = CSV.stringify(exported.rows);
  assert.equal(ok(await admin.act('previewEnrollmentImport', { institutionId: 'northstar', csv: exportedCsv })).errors.length, 0, 'exported optional display columns can be imported again');
  assert.equal(ok(await admin.act('importEnrollments', { institutionId: 'northstar', csv: exportedCsv })).imported, 0, 'an export-import round trip is idempotent');
  const course = ok(await real.act('workspace', 'createCourse', { title: 'Real course to keep', description: 'This course belongs to the regular account.' }));
  const realCourseId = course.courseId;
  ok(await real.act('workspace', 'addMaterial', { courseId: realCourseId, title: 'Public lesson', topic: 'Public learning', duration: 25, content: 'A real public lesson.' }));
  ok(await real.act('workspace', 'publishCourse', { courseId: realCourseId }));
  const enrolledPublicCourse = ok(await other.act('createJourney', { title: 'Public course enrollment', contentIds: [realCourseId] }));
  assert.ok(enrolledPublicCourse.academy.courses.some(c => c.id === realCourseId), 'adding a published course also grants its course delivery access atomically');
  assert.ok(enrolledPublicCourse.academy.courses.find(c => c.id === realCourseId).learnerIds.includes(enrolledPublicCourse.snapshot.activeUserId));
  const ownPublicData = current(enrolledPublicCourse.snapshot);
  assert.equal(ownPublicData.journeys[0].items[0].sourceCourseId, realCourseId, 'versioned material retains its public course source');
  const fixtureCourse = ok(await teacher.act('workspace', 'createCourse', { title: 'Temporary fixture course', description: 'This course is created through the actual API by a test account.' }));
  assert.equal(readState(app.db).academy.courses.find(c => c.id === fixtureCourse.courseId).testDataTag, TEST_DATA_TAG);
  const courseQuiz = ok(await teacher.act('workspace', 'createCourseQuiz', { courseId: 'cs-201', title: 'A fixture assessment', questions: [{ prompt: 'Which is constant time?', options: ['Array index access', 'Linear scan', 'Selection sort', 'All pairs'], answer: 0, explanation: 'An array index identifies the element directly.' }] }));
  const learnerQuiz = ok(await student.request()).academy.courseQuizzes.find(q => q.id === courseQuiz.quizId);
  assert.equal(learnerQuiz.questions[0].answer, undefined, 'academic quiz keys are hidden from learners');
  const academicAttempt = ok(await student.act('workspace', 'submitCourseQuiz', { quizId: learnerQuiz.id, revision: learnerQuiz.revision, answers: { [learnerQuiz.questions[0].id]: 0 } }));
  assert.equal(academicAttempt.academy.courseQuizAttempts.find(a => a.id === academicAttempt.attemptId).percent, 100);
  ok(await student.act('workspace', 'submitAssignment', { assignmentId: 'complexity-assignment', body: 'Arrays support indexed access. A scan checks elements. A hash map supports key lookup.' }));
  const submission = ok(await teacher.request()).academy.submissions.find(s => s.assignmentId === 'complexity-assignment' && s.userId === 'riya');
  ok(await teacher.act('workspace', 'grade', { submissionId: submission.id, score: 9, feedback: 'Clear comparison.', released: true }));
  const certificate = ok(await teacher.act('workspace', 'issueCertificate', { courseId: 'cs-201', userId: 'riya' }));
  assert.ok(certificate.certificateId);
  for (const field of ['courseQuizzes', 'courseQuizAttempts', 'certificates']) assert.ok(readState(app.db).academy[field].every(record => record.testDataTag === TEST_DATA_TAG), 'new fixture assessment/credential records inherit test ownership');
  ok(await admin.act('workspace', 'createInstitution', { name: 'Extra test institution', username: 'fixture_extra_school' }));
  assert.ok(readState(app.db).reservedUsernames.includes('fixture_extra_school'));
  ok(await admin.act('workspace', 'enroll', { courseId: 'cs-201', username: 'real_learner', role: 'student' }));
  assert.equal(current(ok(await real.request()).snapshot).memberships[0].testDataTag, TEST_DATA_TAG);
  const adoptedTestContent = ok(await real.act('adoptJourney', 'dsa-journey'));
  const retainedJourneyId = adoptedTestContent.journeyId;
  const cleanup = cleanDatabase(dbPath);
  assert.equal(cleanup.accountsRemoved, 3);
  const afterCleanup = ok(await real.request());
  assert.ok(afterCleanup.academy.courses.some(c => c.id === realCourseId), 'cleanup preserves real course records');
  assert.ok(current(afterCleanup.snapshot).journeys.some(j => j.id === retainedJourneyId), 'cleanup preserves a real learner’s copied content');
  assert.deepEqual(current(afterCleanup.snapshot).evidence, personalBeforeSeed.evidence, 'cleanup preserves private real evidence');
  assert.equal(current(afterCleanup.snapshot).memberships.length, 0, 'test-created grants are removed without dangling scopes');
  assert.equal(readState(app.db).reservedUsernames.includes('fixture_extra_school'), false, 'cleanup releases handles of newly fixture-created institutions');
  for (const field of ['courseQuizzes', 'courseQuizAttempts', 'certificates']) assert.equal(readState(app.db).academy[field].length, 0, 'cleanup removes tagged assessment and credential fixtures');
  assert.equal(ok(await student.request()).snapshot.activeUserId, null, 'test sessions are revoked on cleanup');
  assert.equal(cleanDatabase(dbPath).accountsRemoved, 0, 'cleanup is repeatable');

  await app.close();
  await start();
  const restored = ok(await real.request());
  assert.equal(restored.snapshot.activeUserId, realId, 'sessions survive a server restart until expiry');
  assert.equal(current(restored.snapshot).evidence.length, 1, 'learning records survive a server restart');
  ok(await real.act('logout'));
  assert.equal((await real.act('createJourney', { title: 'after logout' })).status, 401);
  ok(await real.act('login', 'real_learner', 'real-test-password'));
  const competing = await Promise.all([client().act('register', { username: 'same_handle', displayName: 'First', email: 'first@example.test', password: 'valid-password' }), client().act('register', { username: 'same_handle', displayName: 'Second', email: 'second@example.test', password: 'valid-password' })]);
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 400], 'concurrent registrations cannot reserve the same handle');
  const handleOwner = client();
  ok(await handleOwner.act('register', { username: 'riya_learns', displayName: 'A real handle owner', email: 'handle@example.test', password: 'valid-password' }));
  const beforeSeedConflict = readState(app.db);
  await assert.rejects(seedDatabase(dbPath), /conflicts with an existing non-test identity/);
  assert.deepEqual(readState(app.db), beforeSeedConflict, 'a fixture collision rolls back every attempted merge');
  ok(await handleOwner.act('updateSettings', { username: 'normal_handle_owner' }));
  await seedDatabase(dbPath);
  ok(await admin.act('login', 'northstar_admin', 'demo123'));
  ok(await admin.act('workspace', 'enroll', { courseId: 'cs-201', username: 'real_learner', role: 'student' }));
  ok(await real.act('workspace', 'post', { courseId: 'cs-201', body: 'Real work that cleanup must preserve.' }));
  const beforeBlockedClean = readState(app.db);
  assert.throws(() => cleanDatabase(dbPath), /non-test academic record/);
  assert.deepEqual(readState(app.db), beforeBlockedClean, 'cleanup refuses safely when real academic work depends on test content');
  const guessing = client();
  for (let attempt = 0; attempt < 12; attempt++) {
    const username = attempt % 2 ? ' REAL_LEARNER\t' : 'real_learner';
    assert.equal((await guessing.act('login', username, 'incorrect-password')).status, 401);
  }
  assert.equal((await guessing.act('login', '\treal_learner ', 'real-test-password')).status, 429, 'whitespace and case variants share the account failure threshold');
  ok(await guessing.act('logout', { username: 'real_learner' }));
  assert.equal((await guessing.act('login', 'real_learner', 'real-test-password')).status, 429, 'anonymous logout cannot clear another account throttle');
  ok(await other.act('login', 'other_learner', 'another-pass'));
  const previewPort = app.server.address().port;
  await app.close();
  app = null;
  previewProcess = spawn(process.execPath, ['server.js', '--port', String(previewPort), '--db', dbPath], { cwd: root, env: { ...process.env, HOST: '127.0.0.1', PUBLIC_ORIGIN: '', RENDER_EXTERNAL_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const startup = await Promise.race([
    once(previewProcess.stdout, 'data').then(([data]) => data.toString()),
    once(previewProcess, 'exit').then(([code]) => { throw Error('Preview exited before startup: ' + code); })
  ]);
  assert.match(startup, /Learnio is running/);
  assert.equal((await fetch(base + '/')).status, 200, 'the server entry point serves the application');
  for (const route of ['/data/learnio.sqlite', '/data/learnio.sqlite.backup.json', '/server.js', '/tmp/preview.cjs']) assert.equal((await fetch(base + route)).status, 404, 'preview uses the same private-file restrictions');
  previewProcess.kill();
  await once(previewProcess, 'exit');
  previewProcess = null;
  passed = true;
  console.log('Learnio HTTP checks passed: SQLite persistence, cookie sessions, auth isolation, server quiz scoring, source validation, origin checks, static isolation, and safe seed/cleanup.');
} finally {
  if (previewProcess && previewProcess.exitCode === null && previewProcess.signalCode === null) { previewProcess.kill(); await once(previewProcess, 'exit'); }
  await app?.close();
  if (passed) {
    assert.ok(path.resolve(directory).startsWith(path.resolve(temporaryRoot) + path.sep));
    rmSync(directory, { recursive: true, force: true });
  } else console.error('Failed check database retained at:', dbPath);
}
