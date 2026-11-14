'use strict';
const { randomUUID } = require('node:crypto');
const { createStore } = require('./learning-store.js');
const uid = prefix => `${prefix}-${randomUUID()}`;
const stamp = () => new Date().toISOString();
const fresh = () => ({ courses: [], groups: [], classes: [], posts: [], assignments: [], submissions: [], announcements: [], audit: [], departments: [], programs: [], semesters: [], calendarEvents: [], publications: [], courseQuizzes: [], courseQuizAttempts: [], certificates: [] });
const copy = value => JSON.parse(JSON.stringify(value));
function text(value, name, max = 200, required = true) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new Error(`${name} must contain ${required ? '1' : '0'}–${max} characters.`);
  return result;
}
function url(value) { if (!value) return ''; const result = new URL(value); if (!['http:', 'https:'].includes(result.protocol)) throw new Error('Use an HTTP or HTTPS link.'); return result.href; }
function number(value, name, min, max) { const result = Number(value); if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${name} must be between ${min} and ${max}.`); return result; }
function member(state, userId, institutionId) { return (state.userData[userId]?.memberships || []).find(m => m.institutionId === institutionId && ['active', 'sample'].includes(m.status)); }
function admin(state, userId, institutionId) { return !!institutionId && ['admin', 'administrator'].includes(member(state, userId, institutionId)?.role); }
function teach(state, userId, course) { const m = course.institutionId ? member(state, userId, course.institutionId) : null; return (!course.institutionId || (m && (m.courseIds?.includes(course.id) || admin(state, userId, course.institutionId)))) && !!state.users.find(u => u.id === userId)?.educator && (course.ownerId === userId || course.teacherIds.includes(userId)); }
function access(state, userId, course) { const m = member(state, userId, course.institutionId); return teach(state, userId, course) || admin(state, userId, course.institutionId) || (course.learnerIds.includes(userId) && (!course.institutionId || !!m?.courseIds?.includes(course.id))); }
function requireThat(condition, message = 'You do not have permission for this action.') { if (!condition) throw new Error(message); }
function choice(value, choices, name) { requireThat(choices.includes(value), `Choose a valid ${name}.`); return value; }
function date(value, name, optional = false) {
  if (optional && !value) return '';
  const result = text(value, name, 10);
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result, `Choose a valid ${name.toLowerCase()}.`);
  return result;
}
function institutionRef(data, collection, value, institutionId, name) {
  const id = String(value || '');
  requireThat(!id || data[collection].some(item => item.id === id && item.institutionId === institutionId), `Choose a ${name} from this institution.`);
  return id;
}
function profile(m, user) {
  return { userId: user.id, institutionId: m.institutionId, displayName: user.displayName, username: user.username, role: m.role, rollNumber: m.rollNumber || '', departmentId: m.departmentId || '', programId: m.programId || '', semesterId: m.semesterId || '', admissionYear: m.admissionYear || '', section: m.section || '', advisor: m.advisor || '' };
}
function courseMetadata(data, input, institutionId) {
  const result = {};
  for (const [field, collection, label] of [['semesterId', 'semesters', 'semester'], ['departmentId', 'departments', 'department'], ['programId', 'programs', 'program']]) {
    if (Object.hasOwn(input, field)) { requireThat(institutionId || !input[field], 'Personal courses cannot reference institution records.'); result[field] = institutionRef(data, collection, input[field], institutionId, label); }
  }
  if (Object.hasOwn(input, 'code')) result.code = text(input.code, 'Course code', 30, false);
  if (Object.hasOwn(input, 'credits')) result.credits = number(input.credits, 'Credits', 0, 30);
  if (Object.hasOwn(input, 'kind')) result.kind = choice(input.kind, ['core', 'elective', 'lab'], 'course type');
  return result;
}
function noticeVisible(state, data, userId, notice) {
  const m = member(state, userId, notice.institutionId);
  if (!m) return false;
  if (admin(state, userId, notice.institutionId) || notice.authorId === userId) return true;
  switch (notice.audience || 'all') {
    case 'all': return true;
    case 'students': return m.role === 'student';
    case 'educators': return m.role === 'educator';
    case 'course': return data.courses.some(c => c.id === notice.targetId && c.institutionId === notice.institutionId && access(state, userId, c));
    case 'department': return !!notice.targetId && m.departmentId === notice.targetId;
    case 'program': return !!notice.targetId && m.programId === notice.targetId;
    default: return false;
  }
}
function courseFor(state, data, userId, id, editing = false) { const course = data.courses.find(c => c.id === id); requireThat(course && (editing ? teach(state, userId, course) : access(state, userId, course)), 'This course is not available to your account.'); return course; }
function materials(items, type = 'lesson') {
  requireThat(Array.isArray(items) && items.length > 0 && items.length <= 100, 'Add between 1 and 100 learning items.');
  return items.map(i => { const duration = number(i.duration ?? 30, 'Duration', 1, 600); requireThat(Number.isInteger(duration), 'Duration must use whole minutes.'); return { id: uid('material'), title: text(i.title, 'Item title'), topic: text(i.topic || 'General', 'Topic', 80), duration, description: text(i.description || i.title, 'Description', 4000), content: text(i.content || '', 'Content', 20000, false), sourceUrl: url(i.sourceUrl || ''), type }; });
}
function quizQuestions(questions) {
  requireThat(Array.isArray(questions) && questions.length >= 1 && questions.length <= 20, 'Add between 1 and 20 questions.');
  return questions.map(q => {
    const prompt = text(q.prompt, 'Question', 2000); requireThat(Array.isArray(q.options) && q.options.length === 4, 'Each question needs four answer choices.');
    const options = q.options.map(o => text(o, 'Answer choice', 500)); requireThat(new Set(options.map(o => o.toLowerCase())).size === 4, 'Answer choices must be distinct.');
    const answer = number(q.answer, 'Correct choice', 0, 3); requireThat(Number.isInteger(answer), 'Choose one correct answer.');
    return { id: uid('question'), prompt, options, answer, explanation: text(q.explanation || '', 'Explanation', 2000, false) };
  });
}
const completedSemester = (data, course) => !!course.institutionId && data.semesters.some(s => s.id === course.semesterId && s.institutionId === course.institutionId && s.status === 'completed');
const gradedSubmission = submission => !!submission && (!!submission.gradedAt || submission.released === true || submission.score !== undefined);
function requireCourseWork(data, course) {
  requireThat(!completedSemester(data, course), 'This semester is completed. Its course work is read-only; contact your educator for a record correction.');
}
function quizAnswers(quiz, input, allowEmpty = false) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'Choose answers before saving.');
  const answers = {};
  for (const [id, answer] of Object.entries(input)) {
    requireThat(quiz.questions.some(q => q.id === id) && Number.isInteger(answer) && answer >= 0 && answer < 4, 'One or more answer choices are invalid.');
    answers[id] = answer;
  }
  requireThat(allowEmpty || Object.keys(answers).length > 0, 'Answer at least one question. Unanswered questions count as skipped.');
  return answers;
}
function completionSummary(state, data, course, learnerId) {
  // ponytail: scan the local aggregate; index assessments by course/user if institution volume makes snapshots slow.
  const assignments = data.assignments.filter(a => a.courseId === course.id), quizzes = data.courseQuizzes.filter(q => q.courseId === course.id), blockers = [];
  if (!course.learnerIds.includes(learnerId) || !access(state, learnerId, course)) blockers.push({ type:'enrollment', id:course.id, title:course.title, reason:'An active course enrollment is required.' });
  if (!assignments.length && !quizzes.length) blockers.push({ type:'assessment', id:course.id, title:course.title, reason:'The course needs at least one assessment.' });
  for (const a of assignments) {
    const s = data.submissions.find(s => s.assignmentId === a.id && s.userId === learnerId);
    const reason = !s ? 'Submit this assignment.' : !s.released ? 'A released grade is required.' : !Number.isFinite(s.score) || !(a.maxPoints > 0) || s.score / a.maxPoints < .6 ? 'A released grade of at least 60% is required.' : '';
    if (reason) blockers.push({ type:'assignment', id:a.id, title:a.title, reason });
  }
  for (const q of quizzes) {
    const a = data.courseQuizAttempts.find(a => a.quizId === q.id && a.revision === q.revision && a.userId === learnerId);
    if (!a || !Number.isFinite(a.percent) || a.percent < 60) blockers.push({ type:'quiz', id:q.id, title:q.title, reason:!a ? 'Submit the current quiz revision.' : 'Pass the current quiz revision with at least 60%.' });
  }
  return { courseId:course.id, userId:learnerId, eligible:!blockers.length, blockers, assignmentCount:assignments.length, quizCount:quizzes.length, activeRecordId:data.certificates.find(r => r.courseId === course.id && r.userId === learnerId && r.courseVersion === course.version && !r.revokedAt)?.id || '' };
}
function certificateEligibility(state, data, course, learnerId) {
  const summary = completionSummary(state,data,course,learnerId); requireThat(summary.eligible,summary.blockers[0]?.reason);
  const assignments = data.assignments.filter(a => a.courseId === course.id), quizzes = data.courseQuizzes.filter(q => q.courseId === course.id);
  const grades = assignments.map(a => { const s = data.submissions.find(s => s.assignmentId === a.id && s.userId === learnerId); return { assignmentId: a.id, title: a.title, score: s.score, maxPoints: a.maxPoints, gradedAt: s.gradedAt }; });
  const results = quizzes.map(q => { const a = data.courseQuizAttempts.find(a => a.quizId === q.id && a.revision === q.revision && a.userId === learnerId); return { quizId: q.id, revision: q.revision, title: q.title, percent: a.percent, submittedAt: a.submittedAt }; });
  return { assignments: grades, quizzes: results, passPercent: 60 };
}
function catalogue(state, userId) {
  const data = { ...fresh(), ...(state.academy || {}) };
  const courseEntries = data.courses.filter(c => c.materials.length && c.status === 'published' && !c.institutionId).map(c => ({ id: c.id, type: 'course', title: c.title, description: c.description, publisher: state.users.find(u => u.id === c.ownerId)?.displayName || 'Educator', publisherType: 'Educator', institution: c.institutionId ? member(state, userId, c.institutionId)?.institutionName || c.institutionId : '', topics: [...new Set(c.materials.map(m => m.topic))], companies: [], level: 'Beginner', minutes: c.materials.reduce((n, m) => n + m.duration, 0), outcomes: c.materials.map(m => m.title), version: c.version, items: c.materials.map(m => ({ ...m, sourceId: m.id, type: 'lesson' })) }));
  return copy([...courseEntries, ...data.publications]);
}
function snapshot(state, userId) {
  const data = { ...fresh(), ...(state.academy || {}) }, memberships = state.userData[userId]?.memberships || [];
  const user = state.users.find(u => u.id === userId);
  const institutions = memberships.filter(m => ['active', 'sample'].includes(m.status)).map(m => ({ id: m.institutionId, name: m.institutionName || m.name || m.institutionId, role: m.role, currentSemesterId: data.semesters.find(s => s.institutionId === m.institutionId && s.status === 'current')?.id || '', profile: profile(m, user) }));
  const institutionIds = new Set(institutions.map(i => i.id));
  const courses = data.courses.filter(c => access(state, userId, c));
  const courseIds = new Set(courses.map(c => c.id));
  const admins = new Set(institutions.filter(i => admin(state, userId, i.id)).map(i => i.id));
  const rosterIds = new Set(courses.flatMap(c => [c.ownerId, ...c.learnerIds, ...c.teacherIds]));
  state.users.forEach(u => { if ((state.userData[u.id]?.memberships || []).some(m => admins.has(m.institutionId))) rosterIds.add(u.id); });
  const submissions = data.submissions.filter(s => courseIds.has(s.courseId) && (s.userId === userId || courses.some(c => c.id === s.courseId && teach(state, userId, c)))).map(s => {
    const result = copy(s), course = courses.find(c => c.id === s.courseId);
    result.canUpdate = s.userId === userId && !gradedSubmission(s) && !completedSemester(data, course);
    result.assessmentStatus = s.released ? 'released' : gradedSubmission(s) ? 'awaiting-release' : 'submitted';
    if (!teach(state, userId, course)) { delete result.gradeHistory; if (!s.released) { delete result.score; delete result.feedback; delete result.gradedAt; } } return result;
  });
  const canTeachCourse = id => courses.some(c => c.id === id && teach(state, userId, c));
  const courseQuizzes = data.courseQuizzes.filter(q => courseIds.has(q.courseId)).map(q => {
    if (canTeachCourse(q.courseId)) return q;
    return { id: q.id, courseId: q.courseId, title: q.title, revision: q.revision, createdAt: q.createdAt, questions: q.questions.map(({ id, prompt, options }) => ({ id, prompt, options })) };
  });
  const courseQuizAttempts = data.courseQuizAttempts.filter(a => courseIds.has(a.courseId) && (a.userId === userId || canTeachCourse(a.courseId)));
  const certificates = data.certificates.filter(c => courseIds.has(c.courseId) && (c.userId === userId || canTeachCourse(c.courseId)));
  const enrollment = c => ({ isEnrolled: c.learnerIds.includes(userId) || teach(state, userId, c), isCurrentSemester: !!c.institutionId && c.semesterId === institutions.find(i => i.id === c.institutionId)?.currentSemesterId && !!c.semesterId, isCompletedSemester:completedSemester(data,c), canSubmit:c.learnerIds.includes(userId) && !completedSemester(data,c) });
  const courseCatalogue = data.courses.filter(c => institutionIds.has(c.institutionId)).map(c => ({ id: c.id, institutionId: c.institutionId, title: c.title, description: c.description, code: c.code || '', credits: c.credits ?? 0, kind: c.kind || 'core', semesterId: c.semesterId || '', departmentId: c.departmentId || '', programId: c.programId || '', ...enrollment(c), canAccess: access(state, userId, c), canTeach: teach(state, userId, c) }));
  const academicProfiles = state.users.flatMap(u => (state.userData[u.id]?.memberships || []).filter(m => ['active', 'sample'].includes(m.status) && (admins.has(m.institutionId) || u.id === userId)).map(m => profile(m, u)));
  const announcements = data.announcements.filter(a => noticeVisible(state, data, userId, a)).map(a => ({ ...a, category: a.category || 'campus', audience: a.audience || 'all', priority: a.priority || 'normal', isRead: !!member(state, userId, a.institutionId)?.announcementReadIds?.includes(a.id), author: state.users.filter(u => u.id === a.authorId).map(({ id, username, displayName }) => ({ id, username, displayName }))[0] }));
  const courseQuizDrafts = (state.userData[userId]?.courseQuizDrafts || []).filter(d => courseIds.has(d.courseId) && data.courseQuizzes.some(q => q.id === d.quizId && q.revision === d.revision) && !data.courseQuizAttempts.some(a => a.quizId === d.quizId && a.revision === d.revision && a.userId === userId));
  const materialProgress = (state.userData[userId]?.materialProgress || []).filter(p => courseIds.has(p.courseId));
  const completionEligibility = courses.flatMap(c => (teach(state,userId,c) ? c.learnerIds : c.learnerIds.includes(userId) ? [userId] : []).map(id => completionSummary(state,data,c,id)));
  return copy({ institutions, courseCatalogue, academicProfiles, semesters: data.semesters.filter(s => institutionIds.has(s.institutionId)), calendarEvents: data.calendarEvents.filter(e => institutionIds.has(e.institutionId) && (e.scope === 'campus' || e.userId === userId)), courseQuizzes, courseQuizAttempts, courseQuizDrafts, materialProgress, completionEligibility, certificates, courses: courses.map(c => ({ ...c, ...enrollment(c), canTeach: teach(state, userId, c), canAdmin: admin(state, userId, c.institutionId) })), groups: data.groups.filter(g => admins.has(g.institutionId) || (member(state, userId, g.institutionId) && g.memberIds.includes(userId))), classes: data.classes.filter(c => courseIds.has(c.courseId)), posts: data.posts.filter(p => courseIds.has(p.courseId)).map(p => ({ ...p, author: state.users.filter(u => u.id === p.userId).map(({ id, username, displayName }) => ({ id, username, displayName }))[0] })), assignments: data.assignments.filter(a => courseIds.has(a.courseId)), submissions, announcements, roster: state.users.filter(u => rosterIds.has(u.id)).map(({ id, username, displayName, educator }) => ({ id, username, displayName, educator })), audit: data.audit.filter(a => admins.has(a.institutionId)).slice(-100), departments: data.departments.filter(d => institutionIds.has(d.institutionId)), programs: data.programs.filter(d => institutionIds.has(d.institutionId)), publications: data.publications.filter(p => p.ownerId === userId) });
}
function action(state, userId, name, args = []) {
  try {
    const user = state.users.find(u => u.id === userId); requireThat(user, 'Please log in.');
    const data = { ...fresh(), ...(state.academy || {}) };
    const previousIds = new Set(Object.values(data).filter(Array.isArray).flatMap(records => records.map(record => record.id)));
    const input = args[0] || {};
    let result = {}, institutionId = '', courseId = '';
    switch (name) {
      case 'createInstitution': {
        const title = text(input.name, 'Institution name', 150), username = String(input.username || '').trim().toLowerCase();
        requireThat(/^[a-z0-9_]{3,30}$/.test(username), 'Institution username needs 3–30 letters, numbers, or underscores.');
        requireThat(!state.users.some(u => u.username.toLowerCase() === username) && !state.reservedUsernames.includes(username), 'That username is already in use.');
        institutionId = uid('institution'); state.reservedUsernames.push(username);
        state.userData[userId].memberships.push({ id: uid('membership'), institutionId, institutionName: title, username, role: 'administrator', status: 'active', scope: 'institution', courseIds: [], verified: false, source: 'Institution creator' });
        result.institutionId = institutionId; break;
      }
      case 'createCourse': {
        institutionId = String(input.institutionId || '');
        requireThat(institutionId ? admin(state, userId, institutionId) : user.educator, 'Institution administrators create institution courses. Educators can create courses in their personal Studio.');
        const course = { id: uid('course'), title: text(input.title, 'Title'), description: text(input.description, 'Description', 4000), ownerId: userId, institutionId, status: 'draft', version: 1, materials: [], learnerIds: [], teacherIds: user.educator ? [userId] : [], createdAt: stamp(), ...courseMetadata(data, input, institutionId) };
        data.courses.push(course); if (institutionId) { const m = member(state, userId, institutionId); if (!m.courseIds.includes(course.id)) m.courseIds.push(course.id); } result.courseId = course.id; courseId = course.id; break;
      }
      case 'updateCourse': {
        const c = data.courses.find(c => c.id === input.courseId); requireThat(c && (teach(state, userId, c) || admin(state, userId, c.institutionId)), 'This course is not available to your account.');
        const title = text(input.title, 'Title'), description = text(input.description, 'Description', 4000);
        const metadata = courseMetadata(data, input, c.institutionId);
        Object.assign(c, { title, description, ...metadata, version: c.version + 1 }); institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'publishCourse': {
        const c = courseFor(state, data, userId, input.courseId || input, true);
        requireThat(!c.institutionId, 'Institution courses are private. Public course publishing is available only in a personal educator Studio.');
        requireThat(c.materials.length, 'Add a lesson before publishing.'); if(c.status !== 'published') { c.status = 'published'; c.version++; } courseId = c.id; break;
      }
      case 'addMaterial': {
        const c = courseFor(state, data, userId, input.courseId, true), item = materials([input])[0];
        c.materials.push(item); c.version++; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'updateMaterial': {
        const c = courseFor(state, data, userId, input.courseId, true), existing = c.materials.find(m => m.id === input.materialId);
        requireThat(existing, 'Choose a lesson from this course.');
        const item = materials([{...existing, ...input}])[0];
        Object.assign(existing, item, {id:existing.id}); c.version++; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'reorderMaterials': {
        const c = courseFor(state, data, userId, input.courseId, true), ids = input.materialIds;
        requireThat(Array.isArray(ids) && ids.length === c.materials.length && new Set(ids).size === ids.length && ids.every(id => c.materials.some(m => m.id === id)), 'The lesson order must contain every course lesson exactly once.');
        c.materials = ids.map(id => c.materials.find(m => m.id === id)); c.version++; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'saveMaterialProgress': {
        const c = courseFor(state,data,userId,input.courseId);
        requireThat(c.learnerIds.includes(userId), 'Only enrolled learners can save lesson progress.'); requireCourseWork(data,c);
        requireThat(c.materials.some(m => m.id === input.materialId), 'Choose a lesson from this course.');
        requireThat(input.completed === undefined || typeof input.completed === 'boolean', 'Completion must be true or false.');
        const note = input.note === undefined ? undefined : text(input.note,'Private note',4000,false), records = state.userData[userId].materialProgress || [];
        const previous = records.find(p => p.courseId === c.id && p.materialId === input.materialId);
        const progress = previous || { id:uid('material-progress'), courseId:c.id, materialId:input.materialId, note:'', completedAt:'' };
        if(note !== undefined) progress.note = note;
        if(input.completed !== undefined) progress.completedAt = input.completed ? progress.completedAt || stamp() : '';
        progress.updatedAt = stamp(); if(!previous) records.push(progress); state.userData[userId].materialProgress = records;
        result.progressId = progress.id; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'planStudyTime': {
        const c = courseFor(state,data,userId,input.courseId);
        requireThat(typeof input.journeyId === 'string' && input.journeyId.trim(), 'Choose an active personal journey for this study session.');
        requireThat(!!input.materialId !== !!input.assignmentId, 'Choose one course lesson or assignment for this study session.');
        const source = input.materialId ? c.materials.find(m => m.id === input.materialId) : data.assignments.find(a => a.id === input.assignmentId && a.courseId === c.id);
        requireThat(source, 'This course lesson or assignment is not available to your account.');
        // Reuse the personal scheduler's transaction; the workspace server persists the resulting private account once.
        const personal = createStore({ storage:{ getItem:() => JSON.stringify({...state,activeUserId:userId}), setItem:(_key,value) => { state.userData[userId] = JSON.parse(value).userData[userId]; } } });
        result = personal.addStudyReference(input.journeyId,{title:source.title,topic:source.topic || 'Course work',minutes:input.minutes,reference:{courseId:c.id,[input.materialId ? 'materialId' : 'assignmentId']:source.id}});
        requireThat(result.ok,result.error);
        institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'enroll': {
        const c = data.courses.find(c => c.id === input.courseId); requireThat(c && admin(state, userId, c.institutionId));
        const target = state.users.find(u => u.username === String(input.username || '').toLowerCase().trim()); requireThat(target, 'No account has that username. Ask the person to register first.');
        const role = input.role || 'student'; requireThat(['student', 'educator'].includes(role), 'Enrollment cannot grant administrator permissions.');
        requireThat(role !== 'educator' || target.educator, 'The account must enable educator capability before a teaching allocation.');
        let m = member(state, target.id, c.institutionId); const existingAdmin = ['admin', 'administrator'].includes(m?.role);
        if (!m) { m = { id: uid('membership'), institutionId: c.institutionId, institutionName: member(state, userId, c.institutionId).institutionName, role, status: 'active', scope: 'course', courseIds: [], source: 'Administrator enrollment', verified: false }; state.userData[target.id].memberships.push(m); }
        if (!m.courseIds.includes(c.id)) m.courseIds.push(c.id);
        if (role === 'educator' && !existingAdmin) m.role = 'educator';
        const list = role === 'educator' ? c.teacherIds : c.learnerIds; if (!list.includes(target.id)) list.push(target.id);
        institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'createGroup': {
        institutionId = String(input.institutionId || ''); requireThat(admin(state, userId, institutionId));
        const title = text(input.title, 'Group name', 100); data.groups.push({ id: uid('group'), title, institutionId, memberIds: [], courseIds: [] }); break;
      }
      case 'addGroupMember': {
        const group = data.groups.find(g => g.id === input.groupId); requireThat(group && admin(state, userId, group.institutionId));
        const target = state.users.find(u => u.username === String(input.username || '').trim().toLowerCase()); requireThat(target && member(state, target.id, group.institutionId), 'Enroll this account in the institution before adding it to a group.');
        if (!group.memberIds.includes(target.id)) group.memberIds.push(target.id); institutionId = group.institutionId; break;
      }
      case 'createSemester': case 'updateSemester': {
        const previous = name === 'updateSemester' ? data.semesters.find(s => s.id === input.semesterId) : null;
        if (name === 'updateSemester') requireThat(previous, 'Semester not found.');
        institutionId = previous?.institutionId || String(input.institutionId || ''); requireThat(admin(state, userId, institutionId));
        const title = text(input.title, 'Semester name', 100), academicYear = text(input.academicYear, 'Academic year', 30), startDate = date(input.startDate, 'Start date'), endDate = date(input.endDate, 'End date'), status = choice(input.status || 'upcoming', ['current', 'upcoming', 'completed'], 'semester status');
        requireThat(endDate >= startDate, 'The semester end date must be on or after its start date.');
        if (status === 'current') data.semesters.filter(s => s.institutionId === institutionId && s.id !== previous?.id && s.status === 'current').forEach(s => { s.status = 'completed'; });
        if (previous) Object.assign(previous, { title, academicYear, startDate, endDate, status, updatedAt: stamp() });
        else data.semesters.push({ id: uid('semester'), institutionId, title, academicYear, startDate, endDate, status, createdAt: stamp() });
        result.semesterId = previous?.id || data.semesters.at(-1).id; break;
      }
      case 'updateAcademicProfile': {
        institutionId = String(input.institutionId || ''); requireThat(admin(state, userId, institutionId));
        const target = state.users.find(u => u.id === input.userId), m = target && member(state, target.id, institutionId); requireThat(m, 'Choose an active member of this institution.');
        const values = {};
        for (const [field, collection, label] of [['semesterId', 'semesters', 'semester'], ['departmentId', 'departments', 'department'], ['programId', 'programs', 'program']]) if (Object.hasOwn(input, field)) values[field] = institutionRef(data, collection, input[field], institutionId, label);
        for (const [field, label, max] of [['rollNumber', 'Roll or staff number', 40], ['section', 'Section', 50], ['advisor', 'Academic advisor', 150]]) if (Object.hasOwn(input, field)) values[field] = text(input[field], label, max, false);
        if (values.rollNumber) requireThat(!state.users.some(u => u.id !== target.id && member(state, u.id, institutionId)?.rollNumber?.toLowerCase() === values.rollNumber.toLowerCase()), 'This roll or staff number is already assigned in the institution.');
        if (Object.hasOwn(input, 'admissionYear')) { values.admissionYear = input.admissionYear === '' ? '' : number(input.admissionYear, 'Admission year', 1900, 2100); requireThat(values.admissionYear === '' || Number.isInteger(values.admissionYear), 'Admission year must be a whole year.'); }
        Object.assign(m, values); result.userId = target.id; break;
      }
      case 'createCalendarEvent': {
        institutionId = String(input.institutionId || ''); requireThat(member(state, userId, institutionId), 'Choose one of your active institutions.');
        const scope = choice(input.scope || 'personal', ['campus', 'personal'], 'calendar scope'); requireThat(scope === 'personal' || admin(state, userId, institutionId), 'Only administrators can manage the campus calendar.');
        const title = text(input.title, 'Event title'), description = text(input.description || '', 'Description', 4000, false), type = choice(input.type || 'event', ['holiday', 'exam', 'registration', 'event', 'meeting'], 'event type'), startDate = date(input.startDate, 'Start date'), endDate = date(input.endDate || input.startDate, 'End date');
        requireThat(endDate >= startDate, 'The event end date must be on or after its start date.');
        const startTime = text(input.startTime || '', 'Start time', 5, false); requireThat(!startTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime), 'Choose a valid start time.');
        const event = { id: uid('calendar-event'), institutionId, userId: scope === 'personal' ? userId : '', authorId: userId, scope, title, description, type, startDate, endDate, startTime, location: text(input.location || '', 'Location', 200, false), semesterId: institutionRef(data, 'semesters', input.semesterId, institutionId, 'semester'), createdAt: stamp() };
        data.calendarEvents.push(event); result.eventId = event.id; break;
      }
      case 'deleteCalendarEvent': {
        const event = data.calendarEvents.find(e => e.id === input.eventId); requireThat(event && member(state, userId, event.institutionId), 'Calendar event not found.');
        requireThat(event.scope === 'campus' ? admin(state, userId, event.institutionId) : event.userId === userId);
        institutionId = event.institutionId; data.calendarEvents = data.calendarEvents.filter(e => e.id !== event.id); break;
      }
      case 'post': {
        const c = courseFor(state, data, userId, input.courseId), body = text(input.body, 'Message', 4000);
        if(!teach(state,userId,c) && !admin(state,userId,c.institutionId)) requireCourseWork(data,c);
        if (input.parentId) requireThat(data.posts.some(p => p.id === input.parentId && p.courseId === c.id), 'Reply to a message in this course.');
        data.posts.push({ id: uid('post'), courseId: c.id, userId, body, parentId: input.parentId || '', createdAt: stamp() }); institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'createAssignment': {
        const c = courseFor(state, data, userId, input.courseId, true), title = text(input.title, 'Assignment title'), description = text(input.description, 'Instructions', 10000), maxPoints = number(input.maxPoints, 'Maximum points', 1, 10000);
        const dueDate = text(input.dueDate, 'Due date', 10); requireThat(/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && Number.isFinite(Date.parse(dueDate)) && new Date(dueDate).toISOString().slice(0,10) === dueDate, 'Choose a valid due date.');
        data.assignments.push({ id: uid('assignment'), courseId: c.id, title, description, maxPoints, dueDate, createdAt: stamp() }); c.version++; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'submitAssignment': {
        const assignment = data.assignments.find(a => a.id === input.assignmentId); requireThat(assignment, 'Assignment not found.');
        const c = courseFor(state, data, userId, assignment.courseId); requireThat(c.learnerIds.includes(userId), 'Only enrolled learners can submit.');
        requireCourseWork(data,c);
        const body = text(input.body, 'Submission', 12000), sourceUrl = url(input.sourceUrl || '');
        const previous = data.submissions.find(s => s.assignmentId === assignment.id && s.userId === userId);
        requireThat(!gradedSubmission(previous), 'This submission has been graded. Contact your educator for changes.');
        if (previous) { previous.versions ||= []; previous.versions.push({ body: previous.body, sourceUrl: previous.sourceUrl, submittedAt: previous.submittedAt }); Object.assign(previous, { body, sourceUrl, submittedAt: stamp() }); }
        else data.submissions.push({ id: uid('submission'), assignmentId: assignment.id, courseId: c.id, userId, body, sourceUrl, submittedAt: stamp(), released: false });
        institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'grade': {
        const s = data.submissions.find(s => s.id === input.submissionId); requireThat(s, 'Submission not found.');
        const c = courseFor(state, data, userId, s.courseId, true), assignment = data.assignments.find(a => a.id === s.assignmentId);
        const score = number(input.score, 'Score', 0, assignment.maxPoints), feedback = text(input.feedback || '', 'Feedback', 4000, false), reason = text(input.reason || '', 'Correction reason', 1000, !!s.released);
        if (gradedSubmission(s)) { s.gradeHistory ||= []; s.gradeHistory.push({ score: s.score, feedback: s.feedback, released: s.released, gradedAt: s.gradedAt, gradedBy: s.gradedBy, reason, changedAt: stamp() }); }
        Object.assign(s, { score, feedback, gradedAt: stamp(), gradedBy: userId, released: input.released === true }); institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'createCourseQuiz': case 'reviseCourseQuiz': {
        const previous = name === 'reviseCourseQuiz' ? data.courseQuizzes.find(q => q.id === input.quizId) : null;
        if (name === 'reviseCourseQuiz') requireThat(previous, 'Course quiz not found.');
        const c = courseFor(state, data, userId, previous?.courseId || input.courseId, true), title = text(input.title, 'Quiz title'), questions = quizQuestions(input.questions);
        if (previous) { previous.versions ||= []; previous.versions.push({ revision: previous.revision, title: previous.title, questions: copy(previous.questions), revisedAt: stamp() }); Object.assign(previous, { title, questions, revision: previous.revision + 1, updatedAt: stamp() }); result.quizId = previous.id; }
        else { const quiz = { id: uid('course-quiz'), courseId: c.id, title, questions, revision: 1, createdAt: stamp(), authorId: userId }; data.courseQuizzes.push(quiz); result.quizId = quiz.id; }
        c.version++; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'saveCourseQuizDraft': case 'submitCourseQuiz': {
        const quiz = data.courseQuizzes.find(q => q.id === input.quizId); requireThat(quiz, 'Course quiz not found.');
        const c = courseFor(state, data, userId, quiz.courseId); requireThat(c.learnerIds.includes(userId), 'Only enrolled learners can submit a course quiz.');
        requireCourseWork(data,c);
        requireThat(Number(input.revision) === quiz.revision, 'This quiz was revised. Reopen the current version before answering.');
        requireThat(!data.courseQuizAttempts.some(a => a.quizId === quiz.id && a.revision === quiz.revision && a.userId === userId), 'You already submitted this quiz revision.');
        const answers = quizAnswers(quiz,input.answers,name === 'saveCourseQuizDraft');
        if(name === 'saveCourseQuizDraft') {
          const drafts = state.userData[userId].courseQuizDrafts || [], previous = drafts.find(d => d.quizId === quiz.id && d.revision === quiz.revision);
          const draft = {quizId:quiz.id,courseId:c.id,revision:quiz.revision,answers,updatedAt:stamp()};
          if(previous) Object.assign(previous,draft); else drafts.push(draft);
          state.userData[userId].courseQuizDrafts = drafts; institutionId = c.institutionId; courseId = c.id; break;
        }
        const correct = quiz.questions.filter(q => answers[q.id] === q.answer).length, skipped = quiz.questions.filter(q => answers[q.id] === undefined).length;
        const attempt = { id: uid('course-attempt'), quizId: quiz.id, courseId: c.id, userId, title: quiz.title, revision: quiz.revision, questions: copy(quiz.questions), answers, correct, skipped, total: quiz.questions.length, percent: Math.round(100 * correct / quiz.questions.length), submittedAt: stamp() };
        data.courseQuizAttempts.push(attempt);
        state.userData[userId].courseQuizDrafts = (state.userData[userId].courseQuizDrafts || []).filter(d => d.quizId !== quiz.id || d.revision !== quiz.revision);
        result.attemptId = attempt.id; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'issueCertificate': {
        const c = courseFor(state, data, userId, input.courseId, true), learner = state.users.find(u => u.id === input.userId);
        requireThat(learner, 'Choose an enrolled learner.'); const assessment = certificateEligibility(state, data, c, learner.id);
        requireThat(!data.certificates.some(r => r.courseId === c.id && r.userId === learner.id && r.courseVersion === c.version && !r.revokedAt), 'An active completion record already exists for this learner and course version.');
        const certificate = { id: uid('certificate'), serial: `LNR-${randomUUID().replaceAll('-', '').toUpperCase()}`, courseId: c.id, courseTitle: c.title, courseVersion: c.version, institutionId: c.institutionId, userId: learner.id, learnerName: learner.displayName, learnerUsername: learner.username, issuerId: userId, issuerName: user.displayName, issuedAt: stamp(), assessment, history: [] };
        data.certificates.push(certificate); result.certificateId = certificate.id; institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'revokeCertificate': {
        const certificate = data.certificates.find(r => r.id === input.certificateId); requireThat(certificate, 'Completion record not found.');
        const c = courseFor(state, data, userId, certificate.courseId, true); requireThat(!certificate.revokedAt, 'This completion record is already revoked.');
        const reason = text(input.reason, 'Revocation reason', 1000);
        certificate.history.push({ action: 'revoked', reason, actorId: userId, actorName: user.displayName, at: stamp() }); certificate.revokedAt = stamp(); certificate.revokedBy = userId; certificate.revocationReason = reason;
        institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'createClass': {
        const c = courseFor(state, data, userId, input.courseId, true), title = text(input.title, 'Class title'), startAt = text(input.startAt, 'Date and time', 50), minutes = number(input.minutes, 'Duration', 5, 480), joinUrl = url(input.joinUrl || '');
        requireThat(Number.isFinite(Date.parse(startAt)), 'Choose a valid class date and time.');
        const location = text(input.location || '', 'Location', 200, false), classType = choice(input.classType || 'lecture', ['lecture', 'tutorial', 'lab', 'seminar', 'office-hours'], 'class type');
        data.classes.push({ id: uid('class'), courseId: c.id, title, startAt, minutes, joinUrl, location, classType, createdAt: stamp() }); institutionId = c.institutionId; courseId = c.id; break;
      }
      case 'announce': {
        institutionId = String(input.institutionId || ''); requireThat(member(state, userId, institutionId));
        const audience = choice(input.audience || 'all', ['all', 'students', 'educators', 'course', 'department', 'program'], 'announcement audience');
        let targetId = '';
        if (audience === 'course') { targetId = institutionRef(data, 'courses', input.targetId, institutionId, 'course'); requireThat(targetId, 'Choose a course audience.'); }
        if (['department', 'program'].includes(audience)) { targetId = institutionRef(data, audience === 'department' ? 'departments' : 'programs', input.targetId, institutionId, audience); requireThat(targetId, `Choose a ${audience} audience.`); }
        requireThat(admin(state, userId, institutionId) || audience === 'course' && teach(state, userId, data.courses.find(c => c.id === targetId)), 'Educators may publish notices only to their own allocated courses.');
        const announcement = { id: uid('announcement'), institutionId, title: text(input.title, 'Title'), body: text(input.body, 'Announcement', 6000), authorId: userId, createdAt: stamp(), category: choice(input.category || 'campus', ['academic', 'examinations', 'fees', 'scholarships', 'placements', 'campus'], 'notice category'), audience, targetId, priority: choice(input.priority || 'normal', ['normal', 'important', 'urgent'], 'notice priority'), office: text(input.office || '', 'Issuing office', 150, false), reference: text(input.reference || '', 'Reference number', 100, false), attachmentUrl: url(input.attachmentUrl || ''), expiresAt: date(input.expiresAt, 'Expiry date', true) };
        data.announcements.push(announcement); result.announcementId = announcement.id; courseId = audience === 'course' ? targetId : ''; break;
      }
      case 'markAnnouncementRead': case 'archiveAnnouncement': {
        const announcement = data.announcements.find(a => a.id === input.announcementId); requireThat(announcement && noticeVisible(state, data, userId, announcement), 'Announcement not found.');
        institutionId = announcement.institutionId;
        if (name === 'archiveAnnouncement') { requireThat(admin(state, userId, institutionId) || announcement.authorId === userId); requireThat(!announcement.archivedAt, 'This announcement is already archived.'); announcement.archivedAt = stamp(); announcement.archivedBy = userId; }
        else { const m = member(state, userId, institutionId); m.announcementReadIds ||= []; if (!m.announcementReadIds.includes(announcement.id)) m.announcementReadIds.push(announcement.id); }
        break;
      }
      case 'createDepartment': case 'createProgram': {
        institutionId = String(input.institutionId || ''); requireThat(admin(state, userId, institutionId));
        data[name === 'createDepartment' ? 'departments' : 'programs'].push({ id: uid('unit'), institutionId, title: text(input.title, 'Name', 150), description: text(input.description || '', 'Description', 2000, false) }); break;
      }
      case 'publishJourney': {
        const journey = state.userData[userId].journeys.find(j => j.id === input || j.id === input.journeyId); requireThat(journey, 'Choose your own journey.');
        const items = journey.items.filter(item => !item.cancelledAt); requireThat(items.length, 'Add active content to the journey first.');
        requireThat(!items.some(item => item.studyReference), 'Private coursework study references cannot be published in a public journey.');
        requireThat(!(journey.contentReferences || []).some(ref => data.courses.some(c => c.id === ref.id && (c.institutionId || c.status !== 'published'))), 'Private institution or draft course content cannot be republished in a public journey.');
        requireThat(!items.some(item => item.sourceCourseId && data.courses.some(c => c.id === item.sourceCourseId && (c.institutionId || c.status !== 'published'))), 'A public journey cannot include private course items.');
        const previous = data.publications.find(p => p.ownerId === userId && p.type === 'journey' && (p.sourceJourneyId === journey.id || p.id === journey.publicationId || input.entryId && p.id === input.entryId));
        requireThat(!input.entryId || previous, 'Choose one of your published journeys.');
        requireThat(!previous?.sourceJourneyId || previous.sourceJourneyId === journey.id, 'This publication belongs to another source journey.');
        const entry = { id: previous?.id || uid('published-journey'), ownerId: userId, sourceJourneyId:journey.id, type: 'journey', title: journey.title, description: journey.goal || 'A contributor learning journey.', publisher: user.displayName, publisherType: user.educator ? 'Educator' : 'Student contributor', institution: '', topics: [...new Set(items.map(i => i.topic))], companies: [], level: 'Beginner', minutes: items.reduce((n,i) => n + i.duration, 0), outcomes: items.map(i => i.title), version: (previous?.version || 0) + 1, items: items.map(i => ({ sourceId: i.sourceId || i.id, type: i.type, sourceCourseId: i.sourceCourseId || null, title: i.title, topic: i.topic, topics: i.topics, difficulty: i.difficulty, duration: i.duration, description: i.description || i.title, sourceUrl: i.sourceUrl || '', content: i.content || '' })), updatedAt:stamp() };
        if(previous) Object.assign(previous,entry); else data.publications.push(entry);
        journey.publicationId = entry.id; result.entryId = entry.id; result.version = entry.version; break;
      }
      case 'publishSheet': {
        const previous = input.entryId ? data.publications.find(p => p.id === input.entryId && p.ownerId === userId && p.type === 'sheet') : null;
        requireThat(!input.entryId || previous, 'Choose one of your published practice sheets.');
        const items = materials(input.items, 'problem');
        // ponytail: legacy pasted rows keep identity by position; pass sourceId for reorder-aware editing.
        if(previous) items.forEach((item,index) => { const old = previous.items.find(p => p.sourceId === input.items[index].sourceId || p.id === input.items[index].id) || previous.items[index]; if(old) item.id = old.sourceId || old.id; });
        requireThat(new Set(items.map(i => i.id)).size === items.length, 'Each practice problem must have a distinct source identity.');
        const entry = { id: previous?.id || uid('published-sheet'), ownerId: userId, type: 'sheet', title: text(input.title, 'Sheet title'), description: text(input.description, 'Description', 4000), publisher: user.displayName, publisherType: user.educator ? 'Educator' : 'Student contributor', institution: '', topics: [...new Set(items.map(i => i.topic))], companies: [], level: 'Beginner', minutes: items.reduce((n,i) => n + i.duration, 0), outcomes: items.map(i => i.title), version: (previous?.version || 0) + 1, items: items.map(i => ({ ...i, sourceId: i.id })), updatedAt:stamp() };
        if(previous) Object.assign(previous,entry); else data.publications.push(entry);
        result.entryId = entry.id; result.version = entry.version; break;
      }
      default: throw new Error('Unknown academy action.');
    }
    data.audit.push({ id: uid('audit'), action: name, userId, institutionId, courseId, createdAt: stamp() });
    if (user.testDataTag) Object.values(data).filter(Array.isArray).forEach(records => records.forEach(record => { if (!previousIds.has(record.id)) record.testDataTag = user.testDataTag; }));
    state.academy = data;
    return { ok: true, ...result };
  } catch (error) { return { ok: false, error: error.message }; }
}
function seed(state, userIds = ['riya', 'asha', 'maya']) {
  const [studentId, educatorId, adminId] = userIds;
  const data = fresh();
  data.courses.push({ id: 'cs-201', title: 'Data Structures · Section A', description: 'Learn to choose data structures, explain tradeoffs, and solve practical problems.', ownerId: educatorId, institutionId: 'northstar', status: 'private', version: 1, learnerIds: [studentId], teacherIds: [educatorId], createdAt: stamp(), materials: [{ id: 'cs-201-arrays', title: 'Arrays and lookup tradeoffs', topic: 'Arrays', duration: 30, type: 'lesson', description: 'Compare direct indexing, linear scans, and hash lookups.', content: 'An array stores elements in indexed positions. Access by index is constant time. Searching an unsorted array requires checking elements, while a sorted array supports binary search. Choose a structure based on the operations your application needs.', sourceUrl: '' }] });
  data.departments.push({ id: 'computing', institutionId: 'northstar', title: 'Computer Science', description: 'Computing and software systems.' });
  data.groups.push({ id: 'section-a', institutionId: 'northstar', title: 'Section A', memberIds: [studentId], courseIds: ['cs-201'] });
  data.assignments.push({ id: 'complexity-assignment', courseId: 'cs-201', title: 'Compare lookup strategies', description: 'Explain the time and space tradeoffs of an unsorted array, sorted array, and hash map. Include one example for each.', maxPoints: 10, dueDate: '2026-12-15', createdAt: stamp() });
  data.posts.push({ id: 'welcome-post', courseId: 'cs-201', userId: educatorId, body: 'Welcome to Data Structures. Share questions here using your own name so we can learn together.', parentId: '', createdAt: stamp() });
  state.academy = data;
  return data;
}
module.exports = { action, snapshot, catalogue, seed };





