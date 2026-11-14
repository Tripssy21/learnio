import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runPersonaData } from './scripts/persona-data.mjs';
const require = createRequire(import.meta.url);
const { openDatabase, readState, writeState } = require('./server.js');
const { snapshot } = require('./academy.js');
const dir = mkdtempSync(path.join(tmpdir(), 'learnio-personas-'));
const filename = path.join(dir, 'test.sqlite');
const read = () => { const db = openDatabase(filename); try { return readState(db); } finally { db.close(); } };
try {
  const first = await runPersonaData('seed', filename);
  const state = read();
  const identities = state.users.map(u => ({ id: u.id, credentials: u.credentials }));
  for (const data of Object.values(state.userData)) {
    assert.equal(data.journeys.length, 3);
    assert.equal(data.journeys.find(j => j.title.startsWith('Engineering')).items.length, 96);
    assert.equal(data.evidence.filter(e => !e.sample).length, 72);
    assert.ok(data.attempts.length >= 4);
    assert.ok(data.enrollments.length);
    assert.ok(data.journeys.every(j => j.items.every(i => i.note && i.sourceUrl && i.description && i.content)));
    assert.ok(data.attempts.every(a => a.status === 'submitted' && a.result));
  }
  for (const [key, rows] of Object.entries(state.academy)) assert.ok(rows.length, `${key} populated`);
  assert.equal(snapshot(state, 'riya').certificates.length, 2);
  assert.ok(snapshot(state, 'asha').courses.some(c => c.canTeach));
  assert.ok(snapshot(state, 'maya').courses.some(c => c.canAdmin));
  const views = Object.fromEntries(['riya', 'asha', 'maya'].map(id => [id, snapshot(state, id)]));
  const current = state.academy.semesters.find(s => s.status === 'current');
  assert.equal(state.academy.semesters.length, 3);
  assert.deepEqual(new Set(state.academy.semesters.map(s => s.status)), new Set(['current', 'completed', 'upcoming']));
  for (const [id, view] of Object.entries(views)) {
    const college = view.institutions.find(i => i.id === 'northstar');
    assert.equal(college.name, 'Northstar Institute of Technology');
    assert.equal(college.currentSemesterId, current.id);
    for (const field of ['rollNumber', 'departmentId', 'programId', 'semesterId', 'admissionYear', 'section', 'advisor']) assert.ok(college.profile[field], `${id} academic profile ${field} populated`);
    assert.equal(view.calendarEvents.filter(e => e.scope === 'campus').length, 4);
    assert.equal(view.calendarEvents.filter(e => e.scope === 'personal').length, 1);
    assert.ok(view.calendarEvents.every(e => e.scope === 'campus' || e.userId === id), 'Personal reminders are visible only to their owner');
    assert.ok(view.announcements.some(a => a.isRead), `${id} has both read and unread notices`);
    assert.ok(view.announcements.some(a => !a.isRead));
  }
  assert.equal(views.riya.courses.filter(c => c.isCurrentSemester && c.isEnrolled).length, 4, 'Current courses are the student allocation in the active term');
  assert.equal(views.asha.courses.filter(c => c.isCurrentSemester && c.canTeach).length, 4, 'Teacher calendar uses allocated courses');
  assert.equal(views.riya.courses.filter(c => state.academy.semesters.find(s => s.id === c.semesterId)?.status === 'completed').length, 2);
  assert.equal(views.riya.courses.filter(c => state.academy.semesters.find(s => s.id === c.semesterId)?.status === 'upcoming').length, 1);
  const elective = views.riya.courseCatalogue.find(c => !c.canAccess);
  assert.equal(views.riya.courseCatalogue.length, 8, 'Institute catalogue includes an unallocated elective');
  assert.ok(elective && !elective.isEnrolled && elective.isCurrentSemester);
  for (const id of ['riya', 'asha']) for (const collection of ['courses', 'classes', 'assignments', 'courseQuizzes']) assert.ok(!views[id][collection].some(r => (r.courseId || r.id) === elective.id), `Unallocated ${collection} remain private`);
  assert.ok(views.riya.courseCatalogue.every(c => !Object.hasOwn(c, 'materials') && !Object.hasOwn(c, 'learnerIds') && !Object.hasOwn(c, 'teacherIds')), 'Offering summaries contain no private learning records');
  for (const c of state.academy.courses.filter(c => c.institutionId)) for (const field of ['semesterId', 'code', 'credits', 'kind', 'departmentId', 'programId']) assert.ok(c[field], `College offering ${field} populated`);
  assert.ok(state.academy.classes.every(c => c.location && c.classType), 'Scheduled classes have locations and session types');
  const collegeTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const session of state.academy.classes) {
    const [hour, minute] = collegeTime.format(new Date(session.startAt)).split(':').map(Number), startMinutes = hour * 60 + minute;
    assert.ok(startMinutes >= 9 * 60 && startMinutes + session.minutes <= 17 * 60, 'College teaching sessions stay within 09:00–17:00 India time');
    const sessionDate = session.startAt.slice(0, 10);
    assert.ok(!state.academy.calendarEvents.some(e => e.scope === 'campus' && e.type === 'holiday' && sessionDate >= e.startDate && sessionDate <= e.endDate), 'Teaching sessions avoid published campus holidays');
  }
  assert.equal(new Set(state.academy.courses.filter(c => c.institutionId).map(c => c.description)).size, 8, 'Each college subject has its own overview');
  assert.ok(state.academy.courses.filter(c => c.institutionId).every(c => !/Practical module|intentionally not allocated|test student or teacher/i.test(c.description)), 'Course overviews describe the subject rather than fixture implementation');
  const expectedModules = {
    'Data Structures · Section A': ['Arrays', 'Linked lists', 'Hashing', 'Trees'],
    'Python Engineering': ['Python basics', 'Collections', 'Functions', 'Python testing'],
    'Database Design': ['Relational model', 'SQL joins', 'Normalization', 'Transactions'],
    'Web Systems': ['HTTP', 'API integration', 'Accessible interfaces', 'Authentication'],
    'Algorithms Lab': ['Searching', 'Sorting', 'Graph traversal', 'Complexity analysis'],
    'Software Testing': ['Unit testing', 'Integration testing', 'Test design', 'Continuous integration'],
    'Capstone Studio': ['Requirements', 'Architecture', 'Implementation', 'Project review'],
    'Introduction to Machine Learning': ['Data preparation', 'Supervised learning', 'Model selection', 'Evaluation']
  };
  const sourceDomains = new Set(['docs.python.org', 'cs50.harvard.edu', 'www.postgresql.org', 'developer.mozilla.org', 'ocw.mit.edu', 'docs.pytest.org', 'docs.github.com', 'learn.microsoft.com', 'scikit-learn.org']);
  for (const course of state.academy.courses.filter(c => c.institutionId)) {
    assert.deepEqual([...new Set(course.materials.map(m => m.topic))], expectedModules[course.title], `${course.title} has four ordered subject-specific modules`);
    assert.ok(course.materials.every(m => m.description.length >= 40 && m.content.length >= 100 && Number.isInteger(m.duration) && m.duration >= 30 && sourceDomains.has(new URL(m.sourceUrl).hostname)), 'Every college lesson has substantive goals, activity content, estimated time, and an official reference');
    const quizzes = state.academy.courseQuizzes.filter(q => q.courseId === course.id);
    assert.ok(quizzes.length && quizzes.every(q => q.questions.length === 4 && q.questions.every(v => v.explanation.length >= 40)), 'Course-authored quizzes assess all four modules with explanations');
  }
  assert.ok(views.riya.courses.every(c => c.teacherIds.includes('asha') && views.riya.roster.some(u => u.id === 'asha' && u.educator)), 'Allocated student courses have a real roster instructor');
  assert.ok(state.academy.courseQuizAttempts.some(a => a.skipped === 1 && a.percent === 75), 'A passed partial attempt exercises skipped-question reporting');
  assert.ok(state.academy.courseQuizAttempts.some(a => a.percent < 60), 'A failed attempt remains available for performance testing');
  assert.deepEqual(new Set(state.academy.announcements.map(a => a.category)), new Set(['academic', 'examinations', 'fees', 'scholarships', 'placements', 'campus']));
  assert.ok(state.academy.announcements.every(a => a.office && a.reference && a.attachmentUrl && a.expiresAt), 'Notice reference, office, attachment and expiry are populated');
  assert.ok(!views.riya.announcements.some(a => a.audience === 'educators' || a.targetId === elective.id), 'Students receive only notices relevant to their audience');
  assert.ok(views.riya.announcements.some(a => a.archivedAt && a.audience === 'all'), 'Students can consult relevant archived notices');
  assert.ok(views.asha.announcements.some(a => a.audience === 'educators'));
  assert.ok(views.maya.announcements.some(a => a.archivedAt), 'Administrator can review the notice archive');
  const db = openDatabase(filename);
  const unrelated = { id: 'unrelated', username: 'unrelated', email: 'other@example.test' };
  state.users.push(unrelated);
  state.userData.unrelated = { journeys: [], memberships: [], evidence: [], attempts: [], enrollments: [] };
  writeState(db, state); db.close();
  const second = await runPersonaData('seed', filename);
  assert.deepEqual(second.academy, first.academy, 'reseed does not duplicate records');
  const cleaned = await runPersonaData('clean', filename);
  assert.ok(JSON.parse(readFileSync(cleaned.backup)).academy.courses.length);
  await runPersonaData('clean', filename);
  const empty = read();
  assert.deepEqual(empty.users.filter(u => u.id !== 'unrelated').map(u => ({ id: u.id, credentials: u.credentials })), identities);
  assert.deepEqual(empty.users.find(u => u.id === 'unrelated'), unrelated);
  for (const id of ['riya', 'asha', 'maya']) {
    assert.equal(empty.userData[id].journeys.length, 0);
    assert.equal(empty.userData[id].memberships.length, 1);
    assert.equal(empty.userData[id].memberships[0].courseIds.length, 0);
    assert.ok(['rollNumber', 'departmentId', 'programId', 'semesterId', 'admissionYear', 'section', 'advisor', 'announcementReadIds'].every(field => !Object.hasOwn(empty.userData[id].memberships[0], field)), 'Cleanup removes academic profile and notice read state');
  }
  assert.ok(Object.values(empty.academy).every(rows => rows.length === 0));
  await runPersonaData('seed', filename);
  const guardDb = openDatabase(filename), guarded = readState(guardDb);
  guarded.academy.posts.push({ id: 'real-dependent', userId: 'unrelated', courseId: 'cs-201', body: 'Preserve this work.' });
  writeState(guardDb, guarded); guardDb.close();
  await assert.rejects(runPersonaData('clean', filename), /Non-test record/);
  assert.deepEqual(read(), guarded, 'dependency failure rolls back without changes');
  guarded.academy.posts.pop();
  guarded.academy.calendarEvents.push({ id: 'real-calendar-dependent', institutionId: 'other-institute', userId: 'unrelated', scope: 'personal', semesterId: guarded.academy.semesters[0].id, title: 'Preserve this semester reference.' });
  const termGuardDb = openDatabase(filename); writeState(termGuardDb, guarded); termGuardDb.close();
  await assert.rejects(runPersonaData('clean', filename), /Non-test record/);
  assert.deepEqual(read(), guarded, 'Semester dependency failure also rolls back without changes');
  console.log('Persona checks passed: intensive college data, current-course allocation, private calendar and content isolation, targeted notices, repeatability, identity preservation, profile cleanup, backups, and dependency rollback.');
} finally { rmSync(dir, { recursive: true, force: true }); }
