'use strict';
const QUESTIONS = [
    { id: 'arrays-1', topic: 'Arrays', difficulty: 'Beginner', prompt: 'What is the time complexity of accessing an array element by index?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 0, explanation: 'An array index identifies the element directly, so indexed access takes constant time.' },
    { id: 'arrays-2', topic: 'Arrays', difficulty: 'Beginner', prompt: 'Which operation usually requires shifting elements in a contiguous array?', options: ['Read the final element', 'Read the first element', 'Insert at the beginning', 'Read the length'], answer: 2, explanation: 'Inserting at the beginning shifts existing elements to make space.' },
    { id: 'arrays-3', topic: 'Arrays', difficulty: 'Intermediate', prompt: 'A hash set can detect a duplicate in an array in what expected total time?', options: ['O(1)', 'O(n)', 'O(n²)', 'O(2ⁿ)'], answer: 1, explanation: 'Visit every element once and use expected constant-time set membership checks.' },
    { id: 'arrays-4', topic: 'Arrays', difficulty: 'Intermediate', prompt: 'For a sorted array, which strategy can find a pair with a target sum in linear time and constant extra space?', options: ['Try every pair', 'Two pointers moving inward', 'Copy each prefix', 'Sort on every step'], answer: 1, explanation: 'A left and right pointer can move inward based on whether their sum is too small or too large.' },
    { id: 'hash-1', topic: 'Hash maps', difficulty: 'Beginner', prompt: 'A hash map stores which relationship?', options: ['Only sorted values', 'Keys mapped to values', 'Only consecutive integers', 'Only unique values without keys'], answer: 1, explanation: 'A hash map associates keys with values and supports efficient lookup by key.' },
    { id: 'hash-2', topic: 'Hash maps', difficulty: 'Intermediate', prompt: 'What must an implementation handle when two keys produce the same hash bucket?', options: ['A collision', 'A syntax error', 'A recursion limit', 'A missing index'], answer: 0, explanation: 'Hash collisions are expected and are resolved with techniques such as chaining or probing.' },
    { id: 'python-1', topic: 'Python basics', difficulty: 'Beginner', prompt: 'What does len([2, 4, 6]) return?', options: ['2', '3', '6', '12'], answer: 1, explanation: 'len returns the number of elements in the list: three.' },
    { id: 'python-2', topic: 'Python basics', difficulty: 'Beginner', prompt: 'Which Python value is immutable?', options: ['A list', 'A dictionary', 'A set', 'A tuple'], answer: 3, explanation: 'A tuple cannot have its elements replaced, added, or removed after creation.' },
    { id: 'python-3', topic: 'Python basics', difficulty: 'Intermediate', prompt: 'What is list(range(1, 5, 2))?', options: ['[1, 2, 3, 4, 5]', '[1, 3]', '[1, 3, 5]', '[2, 4]'], answer: 1, explanation: 'range includes its start, excludes its stop, and advances by the step, producing 1 and 3.' },
    { id: 'python-4', topic: 'Python basics', difficulty: 'Intermediate', prompt: 'What happens after b = a when a is a list?', options: ['b is an independent deep copy', 'b refers to the same list', 'a becomes empty', 'b becomes a tuple'], answer: 1, explanation: 'Assignment binds another name to the same list; it does not copy the list.' },
    { id: 'functions-1', topic: 'Functions', difficulty: 'Beginner', prompt: 'Which keyword sends a value back from a Python function?', options: ['yielding', 'send', 'return', 'print'], answer: 2, explanation: 'return ends the function call and supplies its result to the caller.' },
    { id: 'functions-2', topic: 'Functions', difficulty: 'Intermediate', prompt: 'Why is a mutable default list argument usually avoided?', options: ['Lists cannot be parameters', 'The same default object is reused across calls', 'It is always slower than a tuple', 'Python converts it to a string'], answer: 1, explanation: 'Defaults are evaluated once when the function is defined. Use None and construct a fresh list inside the function.' }
  ];

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createStore, CATALOGUE, DEFAULT_AVAILABILITY } = require('./learning-store.js');
const CSV = require('./csv.js');
const STORAGE_KEY = 'learnio.local.v1';
const SESSION_AGE = 24 * 60 * 60 * 1000;
const STARTER_CATALOGUE = CATALOGUE.map(entry => ({ ...entry, publisher: 'Learnio starter library', publisherType: 'Starter library', institution: '', sourceKind: 'starter-library' }));
const ACTIONS = new Set(['login', 'register', 'logout', 'updateSettings', 'selectJourney', 'saveDraft', 'clearDraft', 'createJourney', 'previewJourney', 'addContent', 'adoptJourney', 'updateJourney', 'duplicateJourney', 'completeItem', 'completeTask', 'reopenItem', 'saveNote', 'previewSchedule', 'saveSchedule', 'rescheduleTask', 'scheduleQuiz', 'updateScheduledQuiz', 'cancelScheduledQuiz', 'startQuiz', 'answerQuiz', 'markQuestion', 'submitQuiz', 'abandonQuiz', 'workspace', 'previewEnrollmentImport', 'importEnrollments', 'exportEnrollments', 'previewPlanImport', 'importPlanCsv']);
const STATIC_FILES = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']], ['/charts.css', ['charts.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/learning-store.js', ['learning-store.js', 'text/javascript']], ['/learning-charts.js', ['learning-charts.js', 'text/javascript']], ['/journey-plan.js', ['journey-plan.js', 'text/javascript']], ['/api-store.js', ['api-store.js', 'text/javascript']], ['/academy-ui.js', ['academy-ui.js', 'text/javascript']], ['/csv.js', ['csv.js', 'text/javascript']]]);

function emptyState() { return { version: 1, revision: 0, activeUserId: null, users: [], reservedUsernames: [], userData: {} }; }
function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  db.exec('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);');
  db.prepare('INSERT OR IGNORE INTO app_state (id, document) VALUES (1, ?)').run(JSON.stringify(emptyState()));
  return db;
}
function readState(db) { return JSON.parse(db.prepare('SELECT document FROM app_state WHERE id = 1').get().document); }
function writeState(db, state) { db.prepare('UPDATE app_state SET document = ? WHERE id = 1').run(JSON.stringify({ ...state, activeUserId: null })); }
function loadAcademy(rootDir = __dirname) {
  const filename = path.join(rootDir, 'academy.js');
  return fs.existsSync(filename) ? require(filename) : null;
}
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
function cookieToken(req) {
  const candidate = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('learnio_session='))?.slice('learnio_session='.length);
  return candidate && /^[a-f0-9]{64}$/.test(candidate) ? candidate : null;
}
function currentUserId(db, req, state) {
  const token = cookieToken(req);
  if (!token) return null;
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash(token));
  return session && session.expires_at > Date.now() && state.users.some(user => user.id === session.user_id) ? session.user_id : null;
}
function visibleCatalogue(state, userId, academy) {
  return [...STARTER_CATALOGUE, ...(academy?.catalogue?.(state, userId) || [])];
}
function requireInstitutionAdmin(state, userId, value) {
  const institutionId = String(value || '');
  const admin = state.userData[userId]?.memberships.some(m => m.institutionId === institutionId && m.status === 'active' && ['admin', 'administrator'].includes(m.role));
  if (!admin) throw Error('You need an active administrator grant for this institution to manage enrollment files.');
  return institutionId;
}
function previewEnrollmentImport(state, userId, input) {
  const institutionId = requireInstitutionAdmin(state, userId, input?.institutionId);
  if (typeof input.csv !== 'string' || input.csv.length > 250000) throw Error('Choose a CSV file up to 250,000 characters.');
  const parsed = CSV.parse(input.csv);
  const header = parsed.shift()?.map(value => value.trim());
  if (!header || new Set(header).size !== header.length || !['username', 'courseId', 'role'].every(name => header.includes(name)) || header.some(name => !['username', 'courseId', 'role', 'displayName', 'courseTitle'].includes(name))) throw Error('The CSV header needs username,courseId,role; only displayName and courseTitle are optional. Duplicate or unknown columns are not accepted.');
  if (parsed.length > 1000) throw Error('Import at most 1,000 enrollment rows at a time.');
  const rows = [], errors = [], seen = new Set();
  for (const [index, values] of parsed.entries()) {
    if (values.every(value => !value.trim())) continue;
    const fields = Object.fromEntries(header.map((name, column) => [name, (values[column] || '').trim()]));
    const username = fields.username.toLowerCase(), courseId = fields.courseId, role = fields.role.toLowerCase();
    const record = { row: index + 2, username, courseId, role, status: 'new' };
    let error = values.length !== header.length ? 'The number of fields does not match the CSV header.' : '';
    const duplicateKey = username + ':' + courseId;
    if (!error && seen.has(duplicateKey)) error = 'Duplicate username and course in this import.';
    seen.add(duplicateKey);
    if (!error && !['student', 'educator'].includes(role)) error = 'Role must be student or educator; imports cannot grant administrator access.';
    const course = state.academy?.courses.find(c => c.id === courseId && c.institutionId === institutionId);
    if (!error && !course) error = 'Course ID does not belong to this institution.';
    const target = !error && state.users.find(user => user.username === username);
    if (!error && !target) error = 'No account has this username. Ask the person to register first.';
    if (!error && role === 'educator' && !target.educator) error = 'This account must enable educator capability before a teaching allocation.';
    if (error) { record.status = 'error'; record.error = error; errors.push({ row: record.row, message: error }); }
    else {
      record.displayName = target.displayName; record.courseTitle = course.title;
      const membership = state.userData[target.id].memberships.find(m => m.institutionId === institutionId && m.status === 'active' && m.courseIds.includes(course.id));
      if (membership && (role === 'educator' ? course.teacherIds : course.learnerIds).includes(target.id)) record.status = 'already enrolled';
    }
    rows.push(record);
  }
  if (!rows.length) throw Error('Add at least one enrollment row below the CSV header.');
  return { rows, errors, newCount: rows.filter(row => row.status === 'new').length, existingCount: rows.filter(row => row.status === 'already enrolled').length };
}
function captureRecords(state) {
  return { ids: Object.fromEntries(Object.entries(state.academy || {}).filter(([, rows]) => Array.isArray(rows)).map(([key, rows]) => [key, new Set(rows.map(row => row.id))])), memberships: new Set(Object.values(state.userData).flatMap(data => data.memberships.map(m => m.id))) };
}
function parsePlanImport(input) {
  const title = String(input?.title || '').trim();
  if (!title || title.length > 100) throw Error('Give the imported journey a name of 1–100 characters.');
  if (typeof input.csv !== 'string' || input.csv.length > 250000) throw Error('Choose a CSV file up to 250,000 characters.');
  const parsed = CSV.parse(input.csv), header = parsed.shift()?.map(value => value.trim());
  const required = ['type', 'title', 'topic', 'minutes', 'url'], allowed = [...required, 'date', 'startTime', 'fixed'];
  if (!header || new Set(header).size !== header.length || !required.every(name => header.includes(name)) || header.some(name => !allowed.includes(name))) throw Error('Plan CSV needs type,title,topic,minutes,url; date,startTime,fixed are optional. Unknown or duplicate columns are not accepted.');
  if (parsed.length > 1000) throw Error('Import at most 1,000 learning items at a time.');
  const rows = [], errors = [];
  for (const [index, values] of parsed.entries()) {
    if (values.every(value => !value.trim())) continue;
    const fields = Object.fromEntries(header.map((name, column) => [name, (values[column] || '').trim()]));
    const record = { row: index + 2, type: fields.type.toLowerCase(), title: fields.title, topic: fields.topic, minutes: Number(fields.minutes), url: fields.url, date: fields.date || '', startTime: fields.startTime || '', fixed: String(fields.fixed || '').toLowerCase() === 'true', status: 'valid' };
    let error = values.length !== header.length ? 'The number of fields does not match the CSV header.' : '';
    if (!error && !['lesson', 'problem', 'review'].includes(record.type)) error = 'Type must be lesson, problem, or review. Quiz answers and completion states cannot be imported.';
    if (!error && (!record.title || record.title.length > 200 || !record.topic || record.topic.length > 80)) error = 'Provide a title of 1–200 characters and a topic of 1–80 characters.';
    if (!error && (!Number.isInteger(record.minutes) || record.minutes < 1 || record.minutes > 1440)) error = 'Duration must be a whole number from 1 to 1,440 minutes.';
    if (!error && !['', 'true', 'false'].includes(String(fields.fixed || '').toLowerCase())) error = 'Fixed must be true, false, or blank.';
    if (!error && record.url) {
      try { const url = new URL(record.url); if (!['http:', 'https:'].includes(url.protocol)) throw Error(); record.url = url.href; } catch { error = 'Source URLs must be valid http or https links.'; }
    }
    if (!error && record.fixed) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Number.isFinite(Date.parse(record.date)) || new Date(record.date + 'T12:00:00Z').toISOString().slice(0, 10) !== record.date || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record.startTime)) error = 'A fixed session needs a valid YYYY-MM-DD date and HH:mm startTime.';
    }
    if (!error && !record.fixed && (record.date || record.startTime)) error = 'Date and startTime are only supported for fixed sessions.';
    if (error) { record.status = 'error'; record.error = error; errors.push({ row: record.row, message: error }); }
    rows.push(record);
  }
  if (!rows.length) throw Error('Add at least one learning item below the CSV header.');
  const items = rows.map(({ row, status, error, ...item }) => item);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ title, items })).digest('hex');
  return { rows, errors, fields: { title, items, fingerprint, ...(input.startDate ? { startDate: input.startDate } : {}), ...(input.availability ? { availability: input.availability } : {}) } };
}
function tagFixtureRecords(state, userId, before) {
  const tag = state.users.find(u => u.id === userId)?.testDataTag;
  if (!tag) return;
  for (const [key, rows] of Object.entries(state.academy || {})) if (Array.isArray(rows)) for (const row of rows) if (!before.ids[key]?.has(row.id)) row.testDataTag = tag;
  for (const data of Object.values(state.userData)) for (const membership of data.memberships) if (!before.memberships.has(membership.id)) membership.testDataTag = tag;
}
function enrollPublishedCourses(state, userId) {
  const data = state.userData[userId];
  if (!data) return;
  const ids = new Set([...data.enrollments.map(e => e.contentId), ...data.journeys.flatMap(j => [...j.contentReferences.map(ref => ref.id), ...j.items.map(item => item.sourceCourseId).filter(Boolean)])]);
  for (const course of state.academy?.courses || []) {
    if (course.institutionId || course.status !== 'published' || !ids.has(course.id)) continue;
    if (!course.learnerIds.includes(userId)) course.learnerIds.push(userId);
    if (!data.enrollments.some(e => e.contentId === course.id)) data.enrollments.push({ id: crypto.randomUUID(), ownerId: userId, contentId: course.id, version: course.version, enrolledAt: new Date().toISOString(), mode: 'self-paced' });
  }
}
function snapshotPayload(state, userId, academy) {
  const user = state.users.find(user => user.id === userId);
  const snapshot = { version: state.version, revision: state.revision, activeUserId: user?.id || null, users: [], reservedUsernames: [], userData: {} };
  if (user) {
    const { credentials, ...publicUser } = user;
    snapshot.users = [publicUser];
    const data = structuredClone(state.userData[user.id]);
    for (const attempt of data.attempts) {
      attempt.questionCount = attempt.questions.length;
      if (attempt.status !== 'submitted') attempt.questions = attempt.questions.map(({ answer, explanation, ...question }) => question);
    }
    snapshot.userData[user.id] = data;
  }
  return { snapshot, catalogue: visibleCatalogue(state, userId, academy), defaults: DEFAULT_AVAILABILITY, academy: user ? academy?.snapshot?.(state, user.id) || null : null, serverTime: new Date().toISOString() };
}
function headers(res, inlineScripts = []) {
  const hashes = inlineScripts.map(script => "'sha256-" + crypto.createHash('sha256').update(script).digest('base64') + "'").join(' ');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' " + hashes + "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
}
function send(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(Error('Send JSON with Content-Type: application/json.'), { status: 415 });
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 262144) throw Object.assign(Error('This request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(Error('The request body is not valid JSON.'), { status: 400 }); }
}

function createApplication(options = {}) {
  const publicOrigin = options.publicOrigin ? new URL(options.publicOrigin) : null;
  if (publicOrigin && (publicOrigin.protocol !== 'https:' || publicOrigin.username || publicOrigin.password || publicOrigin.pathname !== '/' || publicOrigin.search || publicOrigin.hash)) {
    throw Error('PUBLIC_ORIGIN must be an HTTPS origin without credentials, a path, query, or fragment.');
  }
  const rootDir = options.rootDir || __dirname;
  const db = openDatabase(options.dbPath || path.join(rootDir, 'data', 'learnio.sqlite'));
  const academy = options.academy === undefined ? loadAcademy(rootDir) : options.academy;
  let queue = Promise.resolve();
  const authFailures = new Map();
  // ponytail: one serialized JSON aggregate suits a single local server. Move to relational domain rows and per-record transactions before multi-process or high-concurrency deployment.
  const serialize = work => { const next = queue.then(work); queue = next.catch(() => {}); return next; };
  const server = http.createServer(async (req, res) => {
    headers(res);
    try {
      let origin;
      try { origin = publicOrigin || new URL('http://' + req.headers.host); } catch { return send(res, 400, { ok: false, error: 'Invalid Host header.' }); }
      const allowedHost = publicOrigin
        ? String(req.headers.host || '').toLowerCase() === publicOrigin.host
        : ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && Number(origin.port || 80) === req.socket.localPort;
      if (!allowedHost) return send(res, 403, { ok: false, error: 'This Learnio server accepts its configured address only.' });
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, storage: 'sqlite' });
      if (url.pathname === '/api/session' && req.method === 'GET') {
        return await serialize(() => {
          const state = readState(db);
          send(res, 200, { ok: true, ...snapshotPayload(state, currentUserId(db, req, state), academy) });
        });
      }
      if (url.pathname === '/api/action' && req.method === 'POST') {
        if (req.headers.origin !== origin.origin || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { ok: false, error: 'This change must come from the Learnio page on the same origin.' });
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || !ACTIONS.has(body.action) || !Array.isArray(body.args) || body.args.length > 5) return send(res, 400, { ok: false, error: 'Unsupported action or arguments.' });
        return await serialize(async () => {
          db.exec('BEGIN IMMEDIATE');
          let state, userId;
          try { state = readState(db); userId = currentUserId(db, req, state); }
          catch (error) { db.exec('ROLLBACK'); throw error; }
          if (!userId && !['login', 'register', 'logout'].includes(body.action)) { db.exec('ROLLBACK'); return send(res, 401, { ok: false, error: 'Your session has ended. Reload this page to sign in again.' }); }
          // Use the same account normalization as login; logout cannot reset another account's failures.
          const authKey = req.socket.remoteAddress + ':' + String(body.action === 'login' ? body.args[0] : body.args[0]?.username || '').trim().toLowerCase();
          if (['login', 'register'].includes(body.action)) for (const [key, entry] of authFailures) if (entry.until <= Date.now()) authFailures.delete(key);
          const failure = authFailures.get(authKey);
          if (['login', 'register'].includes(body.action) && failure?.until > Date.now() && failure.count >= 12) { db.exec('ROLLBACK'); return send(res, 429, { ok: false, error: 'Too many sign-in attempts. Wait 15 minutes and try again.' }); }
          let result;
          let sessionUserId = userId;
          let sessionCookie;
          try {
            state.activeUserId = userId;
            if (body.action === 'exportEnrollments') {
              const institutionId = requireInstitutionAdmin(state, userId, body.args[0]?.institutionId);
              const before = captureRecords(state);
              const rows = [['username', 'displayName', 'courseId', 'courseTitle', 'role']];
              for (const course of state.academy?.courses || []) {
                if (course.institutionId !== institutionId) continue;
                for (const [role, userIds] of [['student', course.learnerIds], ['educator', course.teacherIds]]) for (const targetId of userIds) {
                  const target = state.users.find(user => user.id === targetId);
                  const membership = state.userData[targetId]?.memberships.find(m => m.institutionId === institutionId && m.status === 'active' && m.courseIds.includes(course.id));
                  if (target && membership) rows.push([target.username, target.displayName, course.id, course.title, role]);
                }
              }
              state.academy.audit.push({ id: crypto.randomUUID(), action: 'exportEnrollments', userId, institutionId, courseId: '', createdAt: new Date().toISOString(), rowCount: rows.length - 1 });
              tagFixtureRecords(state, userId, before);
              state.revision++; writeState(db, state);
              result = { ok: true, rows, exported: rows.length - 1 };
            } else if (['previewEnrollmentImport', 'importEnrollments'].includes(body.action)) {
              const input = body.args[0];
              const preview = previewEnrollmentImport(state, userId, input);
              if (body.action === 'previewEnrollmentImport') result = { ok: true, ...preview };
              else {
                if (preview.errors.length) throw Error('Fix all CSV errors before importing. No enrollment rows were saved.');
                if (!academy?.action) throw Error('Academic tools are unavailable.');
                const before = captureRecords(state);
                for (const row of preview.rows.filter(row => row.status === 'new')) {
                  const enrollment = academy.action(state, userId, 'enroll', [{ institutionId: input.institutionId, courseId: row.courseId, username: row.username, role: row.role }]);
                  if (!enrollment.ok) throw Error(enrollment.error);
                }
                tagFixtureRecords(state, userId, before);
                state.revision++; writeState(db, state);
                result = { ok: true, imported: preview.newCount, skipped: preview.existingCount };
              }
            } else if (body.action === 'workspace') {
              if (!academy?.action) throw Error('Academic tools are unavailable.');
              const [action, ...args] = body.args;
              const before = captureRecords(state);
              result = await academy.action(state, userId, action, args);
              if (result?.ok !== false) {
                tagFixtureRecords(state, userId, before);
                state.revision++; writeState(db, state);
              }
            } else {
              const storage = {
                getItem(key) { return key === STORAGE_KEY ? JSON.stringify(state) : null; },
                setItem(key, value) { if (key !== STORAGE_KEY) throw Error('Unsupported storage key.'); state = JSON.parse(value); writeState(db, state); }
              };
              const store = createStore({ storage, seed: false, questions: QUESTIONS, catalogue: visibleCatalogue(state, userId, academy) });
              if (!store.getPersistence().available) throw Error('Stored application data needs repair before changes can be saved.');
              if (['previewPlanImport', 'importPlanCsv'].includes(body.action)) {
                const parsed = parsePlanImport(body.args[0]);
                if (body.action === 'previewPlanImport') {
                  result = parsed.errors.length ? { ok: true, rows: parsed.rows, errors: parsed.errors, totalMinutes: 0, finishDate: null, tasksCount: 0, unscheduled: [], warnings: [], alreadyImported: false } : { ...store.previewPlan(parsed.fields), rows: parsed.rows, errors: [] };
                } else {
                  if (parsed.errors.length) throw Error('Fix all plan CSV errors before importing. No journey was saved.');
                  result = store.importPlan(parsed.fields);
                }
              } else result = await store[body.action](...body.args);
              sessionUserId = store.getUser()?.id || null;
              if (result.ok && ['addContent', 'createJourney', 'adoptJourney'].includes(body.action)) { enrollPublishedCourses(state, userId); writeState(db, state); }
            }
            if (!result || result.ok === false) {
              db.exec('ROLLBACK');
              if (['login', 'register'].includes(body.action)) authFailures.set(authKey, { count: failure?.until > Date.now() ? failure.count + 1 : 1, until: Date.now() + 900000 });
              return send(res, body.action === 'login' ? 401 : 400, result || { ok: false, error: 'The action could not be completed.' });
            }
            if (['login', 'register', 'logout'].includes(body.action)) {
              const previousToken = cookieToken(req);
              if (previousToken) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(previousToken));
              db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
              if (sessionUserId) {
                const token = crypto.randomBytes(32).toString('hex');
                db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), sessionUserId, Date.now() + SESSION_AGE);
                sessionCookie = 'learnio_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_AGE / 1000;
              } else sessionCookie = 'learnio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
              if (['login', 'register'].includes(body.action)) authFailures.delete(authKey);
            }
            const payload = snapshotPayload(state, sessionUserId, academy);
            db.exec('COMMIT');
            if (sessionCookie) res.setHeader('Set-Cookie', sessionCookie + (origin.protocol === 'https:' ? '; Secure' : ''));
            return send(res, 200, { ...result, ok: true, ...payload });
          } catch (error) {
            try { db.exec('ROLLBACK'); } catch {}
            return send(res, 400, { ok: false, error: /^SQLITE|database|disk/i.test(error.message) ? 'The database could not save this change. Please retry.' : error.message || 'The action could not be saved.' });
          }
        });
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && STATIC_FILES.has(url.pathname)) {
        const [file, type] = STATIC_FILES.get(url.pathname);
        const filename = path.join(rootDir, file);
        if (!fs.existsSync(filename)) return send(res, 404, { ok: false, error: 'File not found.' });
        const content = fs.readFileSync(filename);
        if (type === 'text/html') headers(res, [...content.toString().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]));
        res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Content-Length': content.length });
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      return send(res, 404, { ok: false, error: 'Not found.' });
    } catch (error) {
      send(res, error.status || 500, { ok: false, error: error.status ? error.message : 'The server could not complete this request.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, db, async close() { if (server.listening) await new Promise(resolve => server.close(resolve)); await queue; db.close(); } };
}

function parseOptions(args = process.argv.slice(2)) {
  const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
  const port = Number(option('port') || process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Use a valid port from 1 to 65535.');
  return { port, host: process.env.HOST || '127.0.0.1', publicOrigin: process.env.PUBLIC_ORIGIN || '', dbPath: path.resolve(option('db') || process.env.LEARNIO_DB || path.join(__dirname, 'data', 'learnio.sqlite')) };
}
function startApplication() {
  const options = parseOptions();
  const app = createApplication(options);
  app.server.listen(options.port, options.host, () => console.log('Learnio is running at ' + (options.publicOrigin || 'http://' + options.host + ':' + options.port)));
  app.server.on('error', error => { console.error('Learnio could not start:', error.message); process.exitCode = 1; app.db.close(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit()));
}
if (require.main === module) startApplication();
module.exports = { createApplication, startApplication, openDatabase, readState, writeState, emptyState, snapshotPayload, loadAcademy, parseOptions, QUESTIONS, STARTER_CATALOGUE };
