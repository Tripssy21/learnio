import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { createStore, PASSWORD_ITERATIONS } = require('../learning-store.js');
const { openDatabase, readState, writeState, loadAcademy, QUESTIONS } = require('../server.js');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEST_DATA_TAG = 'learnio-test-fixtures-v1';

export async function fixtures() {
  let saved;
  const store = createStore({ seed: true, questions: QUESTIONS, storage: { getItem: () => saved || null, setItem: (_key, value) => { saved = value; } } });
  const result = await store.login('riya_learns', 'demo123');
  if (!result.ok) throw Error(result.error);
  const state = JSON.parse(saved);
  state.activeUserId = null;
  for (const user of state.users) {
    const salt = randomBytes(24).toString('hex');
    user.credentials = { algorithm: 'PBKDF2-SHA256', iterations: PASSWORD_ITERATIONS, salt, hash: pbkdf2Sync('demo123', salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex') };
    user.demo = false;
    user.emailVerified = false;
    user.testDataTag = TEST_DATA_TAG;
    const data = state.userData[user.id];
    data.testDataTag = TEST_DATA_TAG;
    for (const membership of data.memberships) { membership.testDataTag = TEST_DATA_TAG; membership.status = 'active'; membership.source = 'Explicit test fixture'; }
  }
  // Generate test academic records in isolation: academy.seed must never replace a live academy aggregate.
  const academy = loadAcademy(rootDir);
  academy?.seed?.(state, ['riya', 'asha', 'maya']);
  for (const rows of Object.values(state.academy || {})) if (Array.isArray(rows)) for (const record of rows) record.testDataTag = TEST_DATA_TAG;
  return state;
}

export async function seedDatabase(filename) {
  const fixture = await fixtures();
  const db = openDatabase(filename);
  try {
    db.exec('BEGIN IMMEDIATE');
    const state = readState(db);
    let accountsCreated = 0, recordsCreated = 0;
    for (const user of fixture.users) {
      const existing = state.users.find(u => u.id === user.id || u.username === user.username);
      if (existing) {
        if (existing.testDataTag !== TEST_DATA_TAG || existing.id !== user.id) throw Error('Test account ' + user.username + ' conflicts with an existing non-test identity. Nothing was changed.');
        continue;
      }
      state.users.push(user); state.userData[user.id] = fixture.userData[user.id]; accountsCreated++;
    }
    state.academy ||= {};
    for (const [key, rows] of Object.entries(fixture.academy || {})) {
      if (!Array.isArray(rows)) continue;
      state.academy[key] ||= [];
      for (const row of rows) {
        const existing = state.academy[key].find(record => record.id === row.id);
        if (existing && existing.testDataTag !== TEST_DATA_TAG) throw Error('Test record ' + row.id + ' conflicts with existing data. Nothing was changed.');
        if (!existing) { state.academy[key].push(row); recordsCreated++; }
      }
    }
    for (const username of fixture.reservedUsernames) {
      if (state.users.some(u => u.username === username && u.testDataTag !== TEST_DATA_TAG)) throw Error('Test institution handle conflicts with a real account. Nothing was changed.');
      const existingMembership = Object.values(state.userData).flatMap(d => d.memberships).find(m => m.username === username && m.testDataTag !== TEST_DATA_TAG);
      if (existingMembership) throw Error('Test institution handle conflicts with a real institution. Nothing was changed.');
      if (!state.reservedUsernames.includes(username)) state.reservedUsernames.push(username);
    }
    state.testData ||= {};
    state.testData[TEST_DATA_TAG] = { reservedUsernames: fixture.reservedUsernames, seededAt: state.testData[TEST_DATA_TAG]?.seededAt || new Date().toISOString() };
    state.revision++;
    writeState(db, state);
    db.exec('COMMIT');
    return { accountsCreated, recordsCreated, usernames: fixture.users.map(u => u.username) };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}

export function cleanDatabase(filename) {
  const db = openDatabase(filename);
  try {
    db.exec('BEGIN IMMEDIATE');
    const state = readState(db);
    const removedIds = new Set(state.users.filter(u => u.testDataTag === TEST_DATA_TAG).map(u => u.id));
    const isTestRecord = record => record.testDataTag === TEST_DATA_TAG || [record.ownerId, record.userId, record.authorId, record.issuerId].some(value => removedIds.has(value));
    const allRecords = Object.values(state.academy || {}).filter(Array.isArray).flat();
    const removedRecordIds = new Set(allRecords.filter(isTestRecord).map(record => record.id));
    const testInstitutionIds = new Set([...removedIds].flatMap(userId => state.userData[userId]?.memberships.filter(m => m.testDataTag === TEST_DATA_TAG).map(m => m.institutionId) || []));
    const testInstitutionHandles = [...removedIds].flatMap(userId => state.userData[userId]?.memberships.filter(m => m.testDataTag === TEST_DATA_TAG && m.username).map(m => m.username) || []);
    const dependentRealRecord = allRecords.find(record => !isTestRecord(record) && ([record.courseId, record.assignmentId, record.quizId, record.submissionId, record.parentId].some(value => removedRecordIds.has(value)) || testInstitutionIds.has(record.institutionId)));
    if (dependentRealRecord) throw Error('Cannot clean test data: non-test academic record ' + dependentRealRecord.id + ' depends on a test course or institution. Move or export that work and remove the dependency first. No records were changed.');
    let recordsRemoved = 0;
    state.users = state.users.filter(u => !removedIds.has(u.id));
    for (const userId of removedIds) { delete state.userData[userId]; db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
    for (const [key, rows] of Object.entries(state.academy || {})) {
      if (!Array.isArray(rows)) continue;
      const kept = rows.filter(record => !isTestRecord(record));
      for (const record of kept) for (const field of ['learnerIds', 'teacherIds', 'memberIds']) if (Array.isArray(record[field])) record[field] = record[field].filter(value => !removedIds.has(value));
      recordsRemoved += rows.length - kept.length;
      state.academy[key] = kept;
    }
    for (const data of Object.values(state.userData)) {
      data.memberships = data.memberships.filter(m => m.testDataTag !== TEST_DATA_TAG);
      for (const membership of data.memberships) membership.courseIds = (membership.courseIds || []).filter(courseId => !removedRecordIds.has(courseId));
    }
    const reserved = new Set([...(state.testData?.[TEST_DATA_TAG]?.reservedUsernames || []), ...testInstitutionHandles]);
    state.reservedUsernames = state.reservedUsernames.filter(username => !reserved.has(username));
    if (state.testData) delete state.testData[TEST_DATA_TAG];
    state.revision++;
    writeState(db, state);
    db.exec('COMMIT');
    return { accountsRemoved: removedIds.size, recordsRemoved };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const dbIndex = process.argv.indexOf('--db');
  const filename = path.resolve(dbIndex < 0 ? process.env.LEARNIO_DB || path.join(rootDir, 'data', 'learnio.sqlite') : process.argv[dbIndex + 1]);
  try {
    if (!['seed', 'clean'].includes(command)) throw Error('Usage: node scripts/test-data.mjs seed|clean [--db path/to/learnio.sqlite]');
    const result = command === 'seed' ? await seedDatabase(filename) : cleanDatabase(filename);
    console.log(JSON.stringify({ command, database: filename, ...result }, null, 2));
    if (command === 'seed') console.log('Test accounts use password demo123. These credentials are created only by the explicit seed command.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
