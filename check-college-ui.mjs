import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import academy from './academy.js';
import { intensiveFixtures } from './scripts/persona-data.mjs';

const state = await intensiveFixtures(), window = {};
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const headSource = app.slice(app.indexOf('function head('), app.indexOf('\nfunction metric('));
class FormDataStub extends Map { constructor(form) { super(form.entries); } }
vm.runInNewContext(readFileSync(new URL('./academy-ui.js', import.meta.url), 'utf8'), { window, FormData: FormDataStub });
const ui = window.LearnioAcademy;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function context(userId, page = 'Courses') {
  const ctx = { ui: { workspace: 'institution', institutionId: 'northstar', courseId: '', page }, esc,
    icon: () => '<svg></svg>', badge: value => `<span class="badge">${esc(value)}</span>`,
    empty: (title, description) => `<p>${title}</p><p>${description}</p>`,
    openDialog: (title, content) => { ctx.dialog = { title, content }; }, closeDialog: () => { ctx.dialog = null; },
    render: () => { ctx.renderCount = (ctx.renderCount || 0) + 1; }, notice: text => { ctx.noticeText = text; },
    formError: (_, text) => { ctx.error = text; }, store: {
      getWorkspace: () => academy.snapshot(state, userId), getUser: () => state.users.find(u => u.id === userId),
      today: () => new Date().toISOString().slice(0, 10), getAttempt: () => null, getJourney: () => null,
      workspace: async (action, values) => { ctx.saved = { action, values }; return academy.action(state, userId, action, [values]); }
    }
  };
  ctx.head = vm.runInNewContext(`${headSource}\nhead`, { ui: ctx.ui, store: ctx.store, esc, accountScope:()=>false });
  return ctx;
}
const click = (ctx, action, id = '') => ui.handleClick({ target: { closest: () => ({ dataset: { academy: action, id } }) }, preventDefault() {} }, ctx);
const change = (ctx, key, value) => ui.handleChange({ target: { dataset: { collegeChange: key }, value } }, ctx);
const cards = html => [...html.matchAll(/<article class="college-course [\s\S]*?<\/article>/g)].map(m => m[0]);
const noticeIds = html => [...html.matchAll(/class="notice-title" data-academy="readAnnouncement" data-id="([^"]+)"/g)].map(m => m[1]);
async function submit(ctx, action, values, formId = 'academy-form') {
  const button = { disabled: false, innerHTML: 'Save', isConnected: true };
  const form = { id: formId, dataset: { academyAction: action }, entries: Object.entries(values), querySelector: () => button };
  ctx.error = '';
  await ui.handleSubmit({ target: form, preventDefault() {} }, ctx);
  assert.equal(ctx.error, '', `${action}: ${ctx.error}`);
  assert.equal(button.disabled, false);
}

// An institution creator can enroll another account; stored names must remain text in that member's actual page renderer.
const securityState = structuredClone(state), institutionName = 'Research & Learning <b data-security-marker="institution">Institute</b>', courseTitle = 'Reasoning & Analysis <i data-security-marker="course">course</i>';
const createInstitution = academy.action(securityState, 'asha', 'createInstitution', [{ name: institutionName, username: 'security_institute' }]);
assert.equal(createInstitution.ok, true);
const createCourse = academy.action(securityState, 'asha', 'createCourse', [{ institutionId: createInstitution.institutionId, title: courseTitle, description: 'An isolated security fixture.' }]);
assert.equal(createCourse.ok, true);
assert.equal(academy.action(securityState, 'asha', 'enroll', [{ courseId: createCourse.courseId, username: 'riya_learns', role: 'student' }]).ok, true);
const securityMember = context('riya', 'Academic profile');
securityMember.ui.institutionId = createInstitution.institutionId;
securityMember.store.getWorkspace = () => academy.snapshot(securityState, 'riya');
for (const page of ['Academic profile', 'Settings']) {
  securityMember.ui.page = page;
  const html = ui.render(securityMember);
  assert.ok(html.includes(`<p class="page-description">${esc(institutionName)}</p>`), `${page} escapes the enrolled institution name through the actual shared head`);
  assert.ok(!html.includes('<b data-security-marker='), `${page} must not create institution markup`);
  assert.ok(!html.includes('&amp;amp;'), `${page} encodes plain ampersands once`);
}
const headingActions = '<button data-security-action="safe">Continue</button>', escapedHeading = securityMember.head(institutionName, courseTitle, headingActions);
assert.ok(escapedHeading.includes(`<h1>${esc(institutionName)}</h1>`), 'The shared heading also escapes plain titles');
assert.ok(escapedHeading.includes(headingActions), 'Intentional action-button HTML remains active');
securityMember.ui.courseId = createCourse.courseId;
for (const page of ['Study material', 'Discussion', 'Quizzes', 'Assignments', 'Grades']) {
  securityMember.ui.page = page;
  const html = ui.render(securityMember);
  assert.ok(html.includes(esc(courseTitle)), `${page} retains safely escaped course text`);
  assert.ok(!html.includes('<i data-security-marker=') && !html.includes('&amp;amp;'), `${page} preserves safe text without double encoding`);
}

const student = context('riya'), teacher = context('asha', 'My teaching'), administrator = context('maya');
assert.equal(cards(ui.render(student)).length, 4, 'Student defaults to four current allocated courses');
assert.equal(student.ui.collegeSemester, 'current');
const terms = student.store.getWorkspace().semesters, current = terms.find(s => s.status === 'current'), past = terms.find(s => s.status === 'completed'), future = terms.find(s => s.status === 'upcoming');
change(student, 'collegeSemester', past.id); assert.equal(cards(ui.render(student)).length, 2);
change(student, 'collegeSemester', future.id); assert.equal(cards(ui.render(student)).length, 1);
change(student, 'collegeSemester', 'all'); assert.equal(cards(ui.render(student)).length, 7);
await click(student, 'collegeCourseView', 'catalogue');
const catalogue = ui.render(student), elective = student.store.getWorkspace().courseCatalogue.find(c => !c.canAccess);
assert.equal(cards(catalogue).length, 8, 'College catalogue shows all offerings');
const electiveCard = cards(catalogue).find(c => c.includes(esc(elective.title)));
assert.ok(electiveCard.includes('Enrollment required'));
assert.ok(electiveCard.includes('data-academy="courseOutline"'));
assert.ok(!electiveCard.includes('data-academy="openCourse"'), 'Unallocated offerings have no course entry action');
assert.ok(!catalogue.includes('data-academy="enroll"'));
await click(student, 'courseOutline', elective.id);
assert.ok(student.dialog.content.includes('Contact your academic office'));
assert.ok(!student.dialog.content.includes('Evaluation lesson'), 'Outline contains metadata only');
for(const material of state.academy.courses.find(c=>c.id===elective.id).materials)assert.ok(!student.dialog.content.includes(esc(material.content)), 'Unallocated lesson content never appears in an outline');
const legacy = context('riya'), legacySnapshot = legacy.store.getWorkspace();
legacy.store.getWorkspace = () => ({...legacySnapshot,semesters:[],institutions:legacySnapshot.institutions.map(i=>({...i,currentSemesterId:''})),courses:legacySnapshot.courses.map(c=>({...c,semesterId:''})),courseCatalogue:legacySnapshot.courseCatalogue.map(c=>({...c,semesterId:''}))});
assert.equal(cards(ui.render(legacy)).length,0,'Courses without an academic term are not classified as current');
change(legacy,'collegeSemester','unassigned');assert.equal(cards(ui.render(legacy)).length,7,'Unassigned legacy enrollments remain accessible through their explicit filter');
assert.equal(cards(ui.render(teacher)).length, 4);
assert.ok(ui.render(teacher).includes('Teaching'));
assert.ok(!ui.render(teacher).includes('data-academy="createCourse"'));
assert.equal(cards(ui.render(administrator)).length, 5, 'Administrator defaults to current offerings including elective');
assert.ok(ui.render(administrator).includes('data-academy="createCourse"'));
assert.ok(ui.render(administrator).includes(`data-academy="openCourse" data-id="${elective.id}"`));
const adminProfile=context('maya','Academic profile');
assert.ok(!ui.render(adminProfile).includes('data-academy="openCourse"'),'Administrative course access is not shown as personal enrollment history');
// The academic dashboard must derive scores from this learner's released work and current quiz revisions.
const academicStudent=context('riya','Academic profile'),academicSnapshot=structuredClone(academicStudent.store.getWorkspace()),academicCourse=academicSnapshot.courses.find(c=>c.semesterId===current.id);
academicStudent.store.getWorkspace=()=>academicSnapshot;
academicSnapshot.assignments=[{id:'academic-released',courseId:academicCourse.id,title:'Released assignment',maxPoints:25,dueDate:'2026-09-01'},{id:'academic-private',courseId:academicCourse.id,title:'Awaiting assignment',maxPoints:100,dueDate:'2026-09-02'}];
academicSnapshot.submissions=[{id:'academic-own',assignmentId:'academic-released',courseId:academicCourse.id,userId:'riya',score:20,released:true,feedback:'Published feedback',gradedAt:'2026-09-02'},{id:'academic-draft',assignmentId:'academic-private',courseId:academicCourse.id,userId:'riya',score:97,released:false,feedback:'PRIVATE FEEDBACK MUST STAY HIDDEN'},{id:'academic-other',assignmentId:'academic-released',courseId:academicCourse.id,userId:'another-student',score:25,released:true}];
academicSnapshot.courseQuizzes=[{id:'academic-quiz',courseId:academicCourse.id,title:'Revised quiz',revision:2}];
academicSnapshot.courseQuizAttempts=[{id:'academic-old-attempt',quizId:'academic-quiz',courseId:academicCourse.id,userId:'riya',revision:1,correct:99,total:100},{id:'academic-current-attempt',quizId:'academic-quiz',courseId:academicCourse.id,userId:'riya',revision:2,correct:3,total:4},{id:'academic-other-attempt',quizId:'academic-quiz',courseId:academicCourse.id,userId:'another-student',revision:2,correct:4,total:4}];
let academicHTML=ui.render(academicStudent);
assert.equal(academicStudent.ui.academicSemester,'current');
assert.equal([...academicHTML.matchAll(/data-academic-course=/g)].length,4,'Dashboard defaults to actual current learner enrollments');
assert.match(academicHTML,/Assignment performance[\s\S]*?class="metric-value">80%/);
assert.match(academicHTML,/Quiz accuracy[\s\S]*?class="metric-value">75%/);
assert.ok(!academicHTML.includes('PRIVATE FEEDBACK MUST STAY HIDDEN'));
assert.ok(academicHTML.includes('Published feedback'));
Object.assign(academicStudent.ui,{academicYear:null,academicSemester:null,academicCourse:null,academicStatus:null,academicView:null});
assert.equal([...ui.render(academicStudent).matchAll(/data-academic-course=/g)].length,4,'Older navigation snapshots without academic filters normalize to the current dashboard');
assert.equal(academicStudent.ui.academicStatus,'all');
await click(academicStudent,'academicView','grades'); academicHTML=ui.render(academicStudent);
const academicRow=academicHTML.match(new RegExp(`<tr data-academic-grade-course="${academicCourse.id}">[\\s\\S]*?<\\/tr>`))[0];
assert.ok(academicRow.includes('20/25')&&academicRow.includes('3/4'),'Grade sheet retains assignment points and quiz answer counts separately');
assert.ok(!academicHTML.includes('97/100')&&!academicHTML.includes('99/100'),'Private draft grades and old quiz revisions do not contribute to the grade sheet');
assert.ok(academicHTML.includes('Official final semester grades and GPA have not been recorded.'));
change(academicStudent,'academicCourse',academicCourse.id);assert.equal([...ui.render(academicStudent).matchAll(/data-academic-grade-course=/g)].length,1);
change(academicStudent,'academicYear',past.academicYear);academicHTML=ui.render(academicStudent);
assert.equal(academicStudent.ui.academicCourse,'all','Changing academic year resets a course from another term');
assert.equal(academicStudent.ui.academicSemester,'all','Historical year shows its available semesters');
assert.equal([...academicHTML.matchAll(/data-academic-grade-course=/g)].length,2);
change(academicStudent,'academicStatus','current');assert.ok(ui.render(academicStudent).includes('No matching course allocations'));
await click(academicStudent,'academicReset');await click(academicStudent,'academicView','performance');
assert.ok(ui.render(academicStudent).includes('PERFORMANCE BY SEMESTER'));
change(academicStudent,'academicSemester','all');await click(academicStudent,'academicView','history');
assert.equal([...ui.render(academicStudent).matchAll(/data-academic-course=/g)].length,7,'Enrollment history filters remain scoped to personal allocations');
academicSnapshot.assignments=[];academicSnapshot.submissions=[];academicSnapshot.courseQuizzes=[];academicSnapshot.courseQuizAttempts=[];
await click(academicStudent,'academicView','grades');assert.ok(ui.render(academicStudent).includes('No released grades'),'Courses without results have an explicit empty score');
const academicTeacher=context('asha','Academic profile'),academicTeacherHTML=ui.render(academicTeacher);
assert.ok(academicTeacherHTML.includes('Teaching allocations')&&!academicTeacherHTML.includes('Semester grade sheet'),'Educator identity shows teaching allocations without learner grade metrics');
assert.ok(!academicTeacherHTML.includes('Correct reasoning and useful tests.'),'Student feedback is never presented as an educator’s personal performance');
student.ui.courseId = 'cs-201'; student.ui.page = 'Overview';
const course = student.store.getWorkspace().courses.find(c => c.id === 'cs-201'), description = ui.render(student), moduleTopics = new Set(course.materials.map(m => m.topic || 'General'));
assert.ok(description.includes('College enrollment only'));
assert.ok(description.includes('Asha Rao'));
assert.equal([...description.matchAll(/<details class="course-description-module"/g)].length, 0, 'Overview summarizes curriculum without repeating the learning list');
const lessonMinutes = course.materials.reduce((n, m) => n + m.duration, 0), workload = lessonMinutes >= 60 ? `${Math.floor(lessonMinutes / 60)}h${lessonMinutes % 60 ? ' ' + lessonMinutes % 60 + 'm' : ''}` : `${lessonMinutes} min`;
assert.ok(description.includes(`<strong>${workload}</strong>`), 'Course workload comes from actual saved lessons');
student.ui.page='Learning';const curriculum=ui.render(student);
assert.equal([...curriculum.matchAll(/<details class="course-description-module"/g)].length,moduleTopics.size);
for (const material of course.materials) { assert.ok(curriculum.includes(esc(material.title))); assert.ok(curriculum.includes(esc(material.description))); }
assert.ok(description.includes('data-academy="assessmentPage"'));
assert.ok(!description.includes('data-academy="publishCourse"'));
assert.ok(!description.includes('data-academy="updateCourse"'));
assert.ok(!description.includes('data-academy="addMaterial"'));
assert.ok(!description.includes('Instructor rating')); assert.ok(!description.includes('Learner reviews'));
await click(student, 'readMaterial', course.materials[0].id);
assert.equal(student.ui.learningMaterialId, course.materials[0].id);
assert.ok(ui.render(student).includes(esc(course.materials[0].content)), 'Canonical learning reader opens actual saved content');
teacher.ui.courseId = 'cs-201'; teacher.ui.page = 'Overview';
assert.ok(ui.render(teacher).includes('data-academy="updateCourse"'));
assert.ok(ui.render(teacher).includes('data-academy="addMaterial"'));
assert.ok(!ui.render(teacher).includes('data-academy="publishCourse"'));
administrator.ui.courseId = 'cs-201'; administrator.ui.page = 'Overview';
assert.ok(ui.render(administrator).includes('data-academy="updateCourse"'));
administrator.ui.page = 'Quizzes'; assert.ok(!ui.render(administrator).includes('data-academy="takeCourseQuiz"'));
administrator.ui.page = 'Assignments'; assert.ok(!ui.render(administrator).includes('data-academy="submitAssignment"'));
teacher.ui.page = 'Quizzes'; assert.ok(ui.render(teacher).includes('data-academy="createCourseQuiz"'));
teacher.ui.page = 'Assignments'; assert.ok(ui.render(teacher).includes('data-academy="reviewAssignment"'));
const studio = context('asha', 'Overview'), published = studio.store.getWorkspace().courses.find(c => !c.institutionId && c.status === 'published');
studio.ui.workspace = 'studio'; studio.ui.courseId = published.id;
assert.ok(ui.render(studio).includes('Published course'));
assert.ok(!ui.render(studio).includes('data-academy="publishCourse"'), 'Published edits are live rather than requiring a redundant publication');
assert.ok(ui.render(studio).includes('live catalog immediately'));
assert.ok(!ui.render(studio).includes('College enrollment only'));
for (const ctx of [student, teacher, administrator]) ctx.ui.courseId = '';
student.ui.page = 'Academic profile';
assert.ok(ui.render(student).includes(student.store.getWorkspace().institutions[0].profile.rollNumber));
assert.ok(!ui.render(student).includes('data-academy="updateAcademicProfile"'));
teacher.ui.page = 'Academic profile';
const navigationSource = app.slice(app.indexOf('const learningNav='), app.indexOf('function render('));
const routeSource = app.slice(app.indexOf('async function restoreRoute('), app.indexOf('\nfunction enrollmentImportDialog'));
const routeContext = { ui: teacher.ui, store: teacher.store, learningNav: [], accountPages: ['Account settings'], location: { hash: '' }, URLSearchParams };
vm.runInNewContext(navigationSource + routeSource, routeContext);
const teacherPages = routeContext.navigation().flatMap(([, pages]) => pages.map(([name]) => name));
for (const [, target] of ui.render(teacher).matchAll(/data-academy="collegePage" data-id="([^"]+)"/g)) assert.ok(teacherPages.includes(target), `Faculty profile link ${target} must survive route restoration`);
routeContext.location.hash = '#My%20teaching?workspace=institution&institution=northstar';
await routeContext.restoreRoute(); assert.equal(teacher.ui.page, 'My teaching');
routeContext.location.hash = `#Overview?workspace=institution&institution=northstar&course=${elective.id}`;
await routeContext.restoreRoute(); assert.equal(teacher.ui.courseId, ''); assert.ok(teacher.ui.routeError.includes('not available'));

student.ui.page = 'Announcements';
const notices = student.store.getWorkspace().announcements, today = student.store.today();
const archived = n => !!n.archivedAt || !!n.expiresAt && n.expiresAt.slice(0, 10) < today;
assert.deepEqual(new Set(noticeIds(ui.render(student))), new Set(notices.filter(n => !archived(n)).map(n => n.id)));
assert.ok(!ui.render(student).includes('Publish announcement'));
change(student, 'noticeStatus', 'unread');
assert.deepEqual(new Set(noticeIds(ui.render(student))), new Set(notices.filter(n => !archived(n) && !n.isRead).map(n => n.id)));
change(student, 'noticeCategory', 'fees');
assert.deepEqual(new Set(noticeIds(ui.render(student))), new Set(notices.filter(n => !archived(n) && !n.isRead && n.category === 'fees').map(n => n.id)));
change(student, 'noticeCategory', 'all'); change(student, 'noticeStatus', 'archived');
assert.deepEqual(new Set(noticeIds(ui.render(student))), new Set(notices.filter(archived).map(n => n.id)));
assert.ok(!ui.render(student).includes('Faculty: moderation'));
const unread = notices.find(n => !n.isRead && !archived(n));
await click(student, 'readAnnouncement', unread.id);
assert.equal(student.saved.action, 'markAnnouncementRead');
assert.equal(student.saved.values.announcementId, unread.id);
assert.equal(student.store.getWorkspace().announcements.find(n => n.id === unread.id).isRead, true);
assert.ok(!student.dialog.content.includes('Archive announcement'));
change(student, 'noticeStatus', 'active');
await submit(student, '', { query: unread.reference }, 'college-notice-filter');
assert.deepEqual(noticeIds(ui.render(student)), [unread.id]);
teacher.ui.page = 'Announcements'; assert.ok(ui.render(teacher).includes('Publish announcement'));
await click(teacher, 'announce');
assert.ok(!teacher.dialog.content.includes('value="all"'));
assert.ok(!teacher.dialog.content.includes(`value="course:${elective.id}"`));
assert.ok(teacher.dialog.content.includes('name="targetAudience"'));

student.ui.page = 'Calendar';
for (const [month, count] of [['2021-02', 28], ['2026-09', 35], ['2026-08', 42]]) {
  student.ui.collegeMonth = month;
  assert.equal([...ui.render(student).matchAll(/class="calendar-day /g)].length, count, `${month} uses only complete weeks intersecting the month`);
}
const personal = student.store.getWorkspace().calendarEvents.find(e => e.scope === 'personal');
student.ui.collegeMonth = personal.startDate.slice(0, 7);
const personalCalendar = ui.render(student);
assert.ok(personalCalendar.includes(esc(personal.title)));
assert.ok(!personalCalendar.includes('Teaching preparation · Asha'));
assert.ok(!personalCalendar.includes('Unallocated elective · Evaluation lab'));
assert.ok(!personalCalendar.includes('data-academy="collegeCalendarView"'), 'One merged calendar replaces the scope switch');
assert.ok(!personalCalendar.includes('data-academy="createCalendarEvent" data-id="campus"'));
administrator.ui.page = 'Calendar'; assert.ok(ui.render(administrator).includes('data-academy="createCalendarEvent" data-id="campus"'));
teacher.ui.page = 'Calendar'; assert.ok(ui.render(teacher).includes('data-academy="createClass"'));
await click(student, 'collegeCalendarMonth', '1');
assert.equal(student.ui.collegeMonth, new Date(`${personal.startDate.slice(0, 7)}-01T12:00:00`).getMonth() === 11 ? `${Number(personal.startDate.slice(0, 4)) + 1}-01` : `${personal.startDate.slice(0, 4)}-${String(Number(personal.startDate.slice(5, 7)) + 1).padStart(2, '0')}`);
student.ui.courseId = 'cs-201'; await click(student, 'collegePage', 'Calendar'); assert.equal(student.ui.courseId, '');
await click(student, 'openCourse', 'missing-course'); assert.equal(student.ui.courseId, '', 'Stale course actions cannot create an invalid course context');

// A fixed month keeps the schedule contract independent of the seed's moving dates.
const scheduleDate = '2028-02-10', emptyDate = '2028-02-20';
const act = (userId, name, values) => { const result = academy.action(state, userId, name, [values]); assert.ok(result.ok, `${name}: ${result.error || ''}`); return result; };
act('asha', 'createClass', { courseId: 'cs-201', title: 'Schedule contract clinic', startAt: `${scheduleDate}T03:30:00Z`, minutes: 60, location: 'Contract lab 1', classType: 'tutorial', joinUrl: '' });
const classId = state.academy.classes.at(-1).id;
const electiveCourse = state.academy.courses.find(c => c.id === elective.id), facultyMembership = state.userData.asha.memberships.find(m => m.institutionId === 'northstar'), priorTeachers = [...electiveCourse.teacherIds], priorCourseIds = [...facultyMembership.courseIds];
act('maya', 'enroll', { courseId: elective.id, username: 'asha_teaches', role: 'educator' });
act('asha', 'createClass', { courseId: elective.id, title: 'Unallocated schedule contract', startAt: `${scheduleDate}T04:30:00Z`, minutes: 60, location: 'Restricted lab', classType: 'lab', joinUrl: '' });
const blockedClassId = state.academy.classes.at(-1).id;
electiveCourse.teacherIds = priorTeachers; facultyMembership.courseIds = priorCourseIds;
act('asha', 'createAssignment', { courseId: 'cs-201', title: 'Schedule contract submission', description: 'Submit the clinic notes.', maxPoints: 10, dueDate: '2028-02-11' });
const reminderIds = new Map();
for (const userId of ['riya', 'asha', 'maya']) reminderIds.set(userId, act(userId, 'createCalendarEvent', { institutionId: 'northstar', scope: 'personal', type: 'meeting', title: `Private contract reminder ${userId}`, startDate: scheduleDate, endDate: scheduleDate, startTime: '08:00', location: 'My study desk' }).eventId);
const campusId = act('maya', 'createCalendarEvent', { institutionId: 'northstar', scope: 'campus', type: 'holiday', title: 'Shared contract campus holiday', startDate: scheduleDate, endDate: scheduleDate, startTime: '', location: 'Campus' }).eventId;
for (const [title, time] of [['Shared contract open day', '12:00'], ['Shared contract registration', '13:00']]) act('maya', 'createCalendarEvent', { institutionId: 'northstar', scope: 'campus', type: 'event', title, startDate: scheduleDate, endDate: scheduleDate, startTime: time, location: 'Main auditorium' });
const cellOn = (html, date) => {
  const action = html.indexOf(`data-academy="collegeCalendarDay" data-id="${date}"`), start = html.lastIndexOf('class="calendar-day ', action), end = html.indexOf('class="calendar-day ', action + 1);
  assert.ok(action >= 0 && start >= 0, `Calendar has a date cell for ${date}`);
  return html.slice(start, end < 0 ? html.indexOf('class="calendar-mobile"', action) : end);
};
const eventButtons = html => [...html.matchAll(/<button[^>]*class="[^"]*campus-schedule-card[^"]*"[\s\S]*?<\/button>/g)].map(m => m[0]);
const textOnly = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/ ?– ?/g, '–').trim();
for (const ctx of [student, teacher, administrator]) {
  ctx.ui.page = 'Calendar'; ctx.ui.collegeMonth = '2028-02';
  const userId = ctx.store.getUser().id, html = ui.render(ctx), cell = cellOn(html, scheduleDate);
  assert.ok(!html.includes('data-academy="collegeCalendarView"'));
  const personalLayer = cell.indexOf('campus-day-layer personal-layer'), campusLayer = cell.indexOf('campus-day-layer campus-layer');
  assert.ok(personalLayer >= 0 && campusLayer > personalLayer, 'Personal schedule is stacked above shared campus events');
  const personalPreview = cell.slice(personalLayer, campusLayer), campusPreview = cell.slice(campusLayer);
  assert.equal([...personalPreview.matchAll(/data-academy="calendarEntry"/g)].length, userId === 'maya' ? 1 : 2);
  assert.equal([...campusPreview.matchAll(/data-academy="calendarEntry"/g)].length, 2, 'Each layer keeps two previews without hiding the other layer');
  assert.ok(cell.includes('schedule-layer-label'));
  assert.ok(cell.includes(`data-id="${reminderIds.get(userId)}"`), 'Each persona sees their own reminder');
  assert.ok(campusPreview.includes('Shared contract'), 'The same calendar includes the campus layer');
  assert.ok(cell.includes('+1 more'), 'Layer overflow opens the complete daily agenda');
  for (const otherId of ['riya', 'asha', 'maya'].filter(id => id !== userId)) assert.ok(!html.includes(`Private contract reminder ${otherId}`), 'Personal reminders stay private across personas');
  assert.ok(!html.includes('Unallocated schedule contract'), 'Administrative access and catalogue visibility do not become personal class allocations');
  assert.equal(html.includes('Schedule contract submission'), userId !== 'maya', 'Only allocated students and teachers see course deadlines');
  await click(ctx, 'collegeCalendarDay', scheduleDate);
  assert.ok(ctx.dialog.title.includes('10 February 2028'));
  const agenda = ctx.dialog.content;
  assert.ok(agenda.includes('campus-day-agenda'));
  assert.ok(agenda.includes('agenda-section'));
  assert.ok(agenda.includes('agenda-timeline'));
  assert.ok(agenda.includes('agenda-campus-list'));
  const buttons = eventButtons(agenda), ownReminder = buttons.find(b => b.includes(`data-id="${reminderIds.get(userId)}"`)), campus = buttons.find(b => b.includes(`data-id="${campusId}"`));
  assert.ok(ownReminder && campus, 'Daily agenda presents both layers as schedule cards');
  assert.ok(agenda.indexOf(ownReminder) < agenda.indexOf(campus), 'Personal agenda appears before the campus agenda');
  assert.ok(!agenda.includes('10 Feb') && !agenda.includes('2028'), 'The date is shown once in the dialog heading');
  assert.ok(textOnly(campus).includes('All day'));
  const classCard = buttons.find(b => b.includes(`data-id="${classId}"`));
  assert.equal(!!classCard, userId !== 'maya', 'Course administration is not a personal teaching allocation');
  assert.ok(!buttons.some(b => b.includes(`data-id="${blockedClassId}"`)));
  if (classCard) {
    assert.ok(textOnly(classCard).includes('09:00–10:00'), 'Class range uses startAt plus its real duration in the user timezone');
    for (const field of ['schedule-time', 'schedule-card-body', 'schedule-card-tags', 'schedule-course', 'schedule-location']) assert.ok(classCard.includes(field), `Schedule card includes ${field}`);
    assert.ok(classCard.includes('class="schedule-card-title"') && classCard.includes('Schedule contract clinic'));
    assert.ok(classCard.includes('Contract lab 1'));
    await click(ctx, 'calendarEntry', classId);
    assert.ok(textOnly(ctx.dialog.content).includes('09:00–10:00'), 'Individual class detail has the same range');
  }
  await click(ctx, 'collegeCalendarDay', emptyDate);
  assert.ok(ctx.dialog.content.includes('Nothing scheduled'));
  const mobile = html.slice(html.indexOf('class="calendar-mobile"'));
  assert.ok(mobile.includes('campus-day-agenda') && mobile.includes('Shared contract campus holiday'), 'Mobile date agendas retain both layers');
}
act('asha', 'createClass', { courseId: 'cs-201', title: 'Midnight schedule contract', startAt: '2028-02-12T18:00:00Z', minutes: 90, location: 'Night lab', classType: 'lab', joinUrl: '' });
const overnightClass = state.academy.classes.at(-1).id;
await click(student, 'collegeCalendarDay', '2028-02-12');
let overnightCard = eventButtons(student.dialog.content).find(b => b.includes(`data-id="${overnightClass}"`));
assert.ok(textOnly(overnightCard).includes('23:30–24:00'));
assert.ok(textOnly(overnightCard).includes('Continues tomorrow'), 'Overnight sessions show only the selected day portion');
await click(student, 'collegeCalendarDay', '2028-02-13');
overnightCard = eventButtons(student.dialog.content).find(b => b.includes(`data-id="${overnightClass}"`));
assert.ok(textOnly(overnightCard).includes('00:00–01:00'));
assert.ok(textOnly(overnightCard).includes('Continued from previous day'), 'An overnight class remains visible on its end date');
await click(student, 'calendarEntry', overnightClass);
assert.ok(textOnly(student.dialog.content).includes('23:30–01:00 (+1 day)'), 'Individual session detail labels its full cross-day range');
act('asha', 'createClass', { courseId: 'cs-201', title: 'Ends exactly at midnight', startAt: '2028-02-14T17:30:00Z', minutes: 60, location: 'Night lab', classType: 'lab', joinUrl: '' });
await click(student, 'collegeCalendarDay', '2028-02-14');
assert.ok(textOnly(student.dialog.content).includes('23:00–24:00'));
await click(student, 'collegeCalendarDay', '2028-02-15');
assert.ok(!student.dialog.content.includes('Ends exactly at midnight'), 'A midnight ending does not create a zero-minute session on the next day');
const previousTimezone = state.users.find(u => u.id === 'riya').timezone;
state.users.find(u => u.id === 'riya').timezone = 'UTC';
await click(student, 'collegeCalendarDay', scheduleDate);
const utcClass = eventButtons(student.dialog.content).find(b => b.includes(`data-id="${classId}"`));
assert.ok(textOnly(utcClass).includes('03:30–04:30'), 'Class ranges follow the user timezone instead of the execution host timezone');
state.users.find(u => u.id === 'riya').timezone = previousTimezone;

await click(administrator, 'createSemester');
for (const field of ['institutionId', 'title', 'academicYear', 'startDate', 'endDate', 'status']) assert.ok(administrator.dialog.content.includes(`name="${field}"`));
await submit(administrator, 'createSemester', { institutionId: 'northstar', title: 'UI contract term', academicYear: '2027–28', startDate: '2027-08-01', endDate: '2027-12-20', status: 'upcoming' });
assert.ok(administrator.store.getWorkspace().semesters.some(s => s.title === 'UI contract term'));
await click(administrator, 'updateAcademicProfile', 'riya');
for (const field of ['institutionId', 'userId', 'rollNumber', 'semesterId', 'departmentId', 'programId', 'admissionYear', 'section', 'advisor']) assert.ok(administrator.dialog.content.includes(`name="${field}"`));
await submit(administrator, 'updateAcademicProfile', { institutionId: 'northstar', userId: 'riya', section: 'B' });
assert.equal(student.store.getWorkspace().institutions[0].profile.section, 'B');
await submit(teacher, 'announce', { institutionId: 'northstar', title: 'UI teacher notice', body: 'Bring your implementation.', category: 'academic', priority: 'normal', targetAudience: 'course:cs-201', office: 'Teaching office', reference: 'UI/1', attachmentUrl: '', expiresAt: '' });
assert.equal(teacher.saved.values.audience, 'course'); assert.equal(teacher.saved.values.targetId, 'cs-201'); assert.equal(teacher.saved.values.targetAudience, undefined);
assert.ok(student.store.getWorkspace().announcements.some(n => n.title === 'UI teacher notice'));
await click(student, 'createCalendarEvent', 'personal');
for (const field of ['institutionId', 'scope', 'type', 'title', 'description', 'startDate', 'endDate', 'startTime', 'location', 'semesterId']) assert.ok(student.dialog.content.includes(`name="${field}"`));
await submit(student, 'createCalendarEvent', { institutionId: 'northstar', scope: 'personal', type: 'meeting', title: 'UI reminder', startDate: today, endDate: today, startTime: '14:00', location: 'Library', semesterId: current.id, description: 'Prepare for the clinic.' });
const reminder = student.store.getWorkspace().calendarEvents.find(e => e.title === 'UI reminder');
assert.ok(reminder); await click(student, 'deleteCalendarEvent', reminder.id);
assert.equal(student.saved.values.eventId, reminder.id);
assert.ok(!student.store.getWorkspace().calendarEvents.some(e => e.id === reminder.id));
await submit(teacher, 'createClass', { courseId: 'cs-201', title: 'UI class', startAt: '2026-10-05T10:30', minutes: '60', location: 'Lab 1', classType: 'lab', joinUrl: '' });
assert.ok(teacher.saved.values.startAt.endsWith('Z'), 'Class form sends an absolute timestamp');
assert.equal(student.store.getWorkspace().classes.find(c => c.title === 'UI class').classType, 'lab');
console.log('College UI checks passed: academic filters and published grades, semester views, safe outlines and routes, role controls, notices, merged layered calendars, private schedules, timezone and overnight ranges, and real form/backend contracts.');
