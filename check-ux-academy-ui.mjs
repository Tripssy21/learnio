import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import academy from './academy.js';
import {intensiveFixtures} from './scripts/persona-data.mjs';

const state=await intensiveFixtures(),window={},drafts=new Map(),runtime={window,FormData:null,sessionStorage:{getItem:k=>drafts.get(k)||null,setItem:(k,v)=>drafts.set(k,v),removeItem:k=>drafts.delete(k)}};
class FormDataStub extends Map{constructor(form){super(form.entries||[]);}}
runtime.FormData=FormDataStub;vm.runInNewContext(readFileSync(new URL('./academy-ui.js',import.meta.url),'utf8'),runtime);
const ui=window.LearnioAcademy,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const run=(user,name,args)=>{const result=academy.action(state,user,name,[args]);assert.ok(result.ok,result.error);return result;};
function context(userId,page='Dashboard'){
 const ctx={ui:{workspace:'institution',institutionId:'northstar',courseId:'',page},esc,icon:()=>'',badge:(value)=>`<span>${esc(value)}</span>`,button:()=>'',empty:(title,copy)=>`<p>${esc(title)} ${esc(copy)}</p>`,head:(title,copy,actions='')=>`<h1>${esc(title)}</h1><p>${esc(copy)}</p>${actions}`,notice:message=>ctx.message=message,formError:(_,message)=>ctx.error=message,openDialog:(title,body,footer='')=>ctx.dialog={title,body,footer},closeDialog:()=>ctx.dialog=null,render:()=>{},go:page=>{ctx.ui.workspace='learning';ctx.ui.page=page;},store:{getUser:()=>state.users.find(u=>u.id===userId),getWorkspace:()=>academy.snapshot(state,userId),getJourneys:()=>state.userData[userId].journeys,getJourney:()=>state.userData[userId].journeys.find(j=>j.id===state.userData[userId].selectedJourneyId)||state.userData[userId].journeys[0],today:()=>new Date().toISOString().slice(0,10),whenIdle:async()=>{},selectJourney:async()=>({ok:true}),workspace:async(name,args)=>academy.action(state,userId,name,[args])}};
 return ctx;
}
const click=(ctx,action,id='',extra={})=>ui.handleClick({target:{closest:()=>({dataset:{academy:action,id,...extra}})},preventDefault(){}},ctx);
const student=context('riya'),teacher=context('asha'),admin=context('maya');
const course=state.academy.courses.find(c=>c.id==='cs-201');
const overdue=run('asha','createAssignment',{courseId:course.id,title:'UX overdue exact task',description:'Explain the required invariant before submitting.',maxPoints:10,dueDate:'2020-01-01'});
const assignmentId=overdue.assignmentId||state.academy.assignments.at(-1).id;
let html=ui.render(student);assert.ok(html.includes('UX overdue exact task')&&html.includes('Overdue'));
assert.ok(html.includes(`data-academy="submitAssignment" data-id="${assignmentId}"`),'Home opens the exact overdue assignment');
await click(student,'submitAssignment',assignmentId);html=ui.render(student);assert.ok(html.includes('Explain the required invariant')&&html.includes('2020'),'The response stays beside its instructions and deadline');
const submitted=run('riya','submitAssignment',{assignmentId,body:'Saved real response',sourceUrl:''});
const submission=state.academy.submissions.find(s=>s.assignmentId===assignmentId&&s.userId==='riya');
run('asha','grade',{submissionId:submission.id,score:8,feedback:'PRIVATE draft feedback',released:false});
html=ui.render(student);assert.ok(html.includes('Awaiting release'));assert.ok(!html.includes('data-academy-action="submitAssignment"'));assert.ok(!html.includes('PRIVATE draft feedback'),'Unreleased feedback is not shown');

const created=run('asha','createCourseQuiz',{courseId:course.id,title:'UX quiz',questions:[{prompt:'First check',options:['A','B','C','D'],answer:0,explanation:'A explanation'},{prompt:'Second check',options:['A','B','C','D'],answer:1,explanation:'B explanation'}]});
await click(student,'takeCourseQuiz',created.quizId);html=ui.render(student);assert.ok(html.includes('save automatically')&&html.includes('Review final submission'));
const quiz=academy.snapshot(state,'riya').courseQuizzes.find(q=>q.id===created.quizId),entries=[['quizId',quiz.id],['revision',String(quiz.revision)],['answer_'+quiz.questions[0].id,'0']],form={id:'academy-form',dataset:{academyAction:'submitCourseQuiz'},entries,querySelector:()=>null};
assert.equal(ui.handleChange({target:{dataset:{courseQuiz:quiz.id},closest:()=>form}},student),true);await Promise.resolve();await Promise.resolve();
assert.equal(academy.snapshot(state,'riya').courseQuizDrafts.find(d=>d.quizId===quiz.id).answers[quiz.questions[0].id],0,'Official draft persists before scored submission');
await ui.handleSubmit({target:form,preventDefault(){}},student);assert.ok(student.dialog.body.includes('1 skipped'),'Final submission explicitly counts skipped answers');
assert.equal(academy.snapshot(state,'riya').courseQuizAttempts.some(a=>a.quizId===quiz.id),false,'Review is not a scored submission');
await click(student,'confirmCourseQuiz');const attempt=academy.snapshot(state,'riya').courseQuizAttempts.find(a=>a.quizId===quiz.id);assert.equal(attempt.correct,1);assert.equal(attempt.skipped,1);assert.ok(ui.render(student).includes('Saved attempt'));
assert.equal(academy.snapshot(state,'riya').courseQuizDrafts.some(d=>d.quizId===quiz.id),false);

teacher.ui.page='Results';teacher.ui.gradingFilter='release';await click(teacher,'grade',submission.id);html=ui.render(teacher);assert.ok(html.includes('Save draft')&&html.includes('Save and release')&&html.includes('Saved real response'));
const releaseButton={dataset:{release:'true'},disabled:false,innerHTML:'Save and release',isConnected:false};
await ui.handleSubmit({target:{id:'academy-form',dataset:{academyAction:'grade'},entries:[['submissionId',submission.id],['score','9'],['feedback','Released useful feedback']],querySelector:()=>releaseButton},submitter:releaseButton,preventDefault(){}},teacher);
assert.equal(academy.snapshot(state,'riya').submissions.find(s=>s.id===submission.id).score,9);assert.ok(ui.render(student).includes('Saved attempt'));
await click(teacher,'gradingBack');assert.equal(teacher.ui.gradingFilter,'release','Queue filter survives grade saving/back');
submission.gradedAt=null;submission.released=false;teacher.ui.courseId=course.id;html=ui.render(teacher);assert.ok(html.includes('UX overdue exact task')&&html.includes('Awaiting release'),'A legacy score without a timestamp stays in the release queue');
submission.released=true;

const material=course.materials[0];await click(student,'readMaterial',material.id);html=ui.render(student);assert.ok(html.includes('Private learning note')&&html.includes('Plan study time'));
run('riya','saveMaterialProgress',{courseId:course.id,materialId:material.id,note:'PRIVATE learner note',completed:true});
assert.ok(ui.render(student).includes('PRIVATE learner note'));assert.equal(academy.snapshot(state,'asha').materialProgress.length,0,'Private notes do not enter teaching records');
teacher.ui.courseId=course.id;teacher.ui.page='Overview';await click(teacher,'previewCourse',course.id);html=ui.render(teacher);assert.ok(html.includes('Learner preview'));assert.ok(!html.includes('data-academy="addMaterial"'));assert.ok(!html.includes('PRIVATE learner note'));
await click(teacher,'previewCourse',course.id);

admin.ui.page='Reports';html=ui.render(admin);assert.ok(html.includes('Semester not assigned')&&html.includes('No allocated educator')&&html.includes('unique students'));
admin.ui.page='Audit log';html=ui.render(admin);assert.ok(html.includes('most recent 100')&&html.includes('Actor')&&html.includes('Saved a grade'));
admin.ui.page='People & enrollment';admin.ui.peopleTab='User groups';assert.ok(ui.render(admin).includes('Organization only'));

student.ui.workspace='learning';student.ui.page='Owned content';html=ui.render(student);assert.ok(html.includes('data-academy="publishSheet"')&&!html.includes('data-academy="createCourse"'),'Learners can author a sheet without gaining course authoring');
await click(student,'publishSheet');assert.equal(student.ui.page,'Editor');html=ui.render(student);assert.ok(html.includes('data-sheet-row')&&html.includes('Save session draft'));
assert.equal(ui.handleInput({target:null},student),false);
const checkbox={name:'completed',type:'checkbox',value:'on',checked:false},note={name:'note',type:'textarea',value:'Unsaved private note'},hidden={name:'materialId',type:'hidden',value:'KEEP ID'},elements=[checkbox,note,hidden];elements.namedItem=name=>elements.find(el=>el.name===name);
const draftForm={dataset:{draftKey:'material:'+material.id},entries:[['note',note.value],['materialId',hidden.value]],elements,querySelector:()=>null};
ui.handleInput({target:{closest:()=>draftForm}},student);checkbox.checked=true;note.value='';hidden.value='TRUSTED CURRENT ID';runtime.document={querySelectorAll:()=>[draftForm]};ui.afterRender(student);assert.equal(checkbox.checked,false,'A deliberately unchecked completion survives draft restore');assert.equal(note.value,'Unsaved private note');assert.equal(hidden.value,'TRUSTED CURRENT ID','Draft restore cannot change source IDs');delete runtime.document;
const legacy=academy.snapshot(state,'asha').publications.find(p=>p.ownerId==='asha'&&p.type==='journey');assert.ok(legacy);delete state.academy.publications.find(p=>p.id===legacy.id).sourceJourneyId;teacher.ui.workspace='studio';teacher.ui.page='Owned content';await click(teacher,'updatePublishedJourney',legacy.id);html=ui.render(teacher);assert.ok(html.includes('Source personal journey')&&html.includes(`name="entryId" value="${legacy.id}"`),'Legacy source selection retains the publication identity');
teacher.ui.workspace='institution';teacher.ui.courseId=course.id;teacher.ui.page='Assessments';await click(teacher,'reviseCourseQuiz',quiz.id);html=ui.render(teacher);assert.ok(html.includes('Previous attempts')&&html.includes('Preview learner quiz'));
console.log('Academy UX checks passed: actionable overdue tasks, submission context and locks, saved official quiz drafts/final summary, grade release/queue, private learning, learner preview, scoped reports/audit, groups, and persistent authoring.');
