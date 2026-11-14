# Learnio walkthrough and test-data guide

This script exercises saved learning and academic workflows against the real local API and SQLite database. Fixture data is optional: normal startup creates no test accounts. Use Node.js 24 or later.

## Prepare an isolated walkthrough

From the project directory:

```powershell
node scripts/test-data.mjs seed --db .\data\learnio-walkthrough.sqlite
node server.js --port 4174 --db .\data\learnio-walkthrough.sqlite
```

Open [the isolated walkthrough](http://127.0.0.1:4174). Keep that terminal running. The separate database and port leave the main application database alone. Repeating `seed` adds missing fixtures without resetting an existing fixture's saved progress.

For the default application database, the equivalent commands are `npm run seed` and `npm start`; open [Learnio](http://127.0.0.1:4173). The main database was cleaned and freshly seeded during the initial 30 September 2026 verification. The subsequent theme/chart checks deliberately leave Riya with one saved problem completion and one 50% personal quiz, so the finished charts display real saved test activity. The server remains on port 4173. This does not change the empty-database default for a new installation; targeted cleanup removes these test records.

| Role | Username | Password |
| --- | --- | --- |
| Student | `riya_learns` | `demo123` |
| Educator | `asha_teaches` | `demo123` |
| Institution administrator | `northstar_admin` | `demo123` |

On the login page, expand **Try a test account** for the three shortcuts, or type the credentials and choose **Log in to Learnio**. The appearance buttons switch Light, Dark, or System without discarding entered form values. Use the account menu to **Sign out** between roles. These accounts use real server login and clearly marked test identities. A newly registered account starts with its own empty personal record and no institution membership.

## Student: complete, reload, and review

1. Log in as `riya_learns`. Select **My Learning → DSA Interview Prep → Today**.
2. Open **Contains Duplicate** from a task or from **Journey plan**. Check that the item title and source match the selected problem. Opening the external source alone does not complete it.
3. Enter a short learning note and choose **Mark complete manually**. The record should identify manual completion. If an earlier walkthrough already completed it, use **Reopen item** first; the older evidence remains corrected history.
4. Return to **Today**, then open **Calendar** and **Progress**. The same item is complete across the shared views, and Progress shows its evidence. Reload the browser and verify that the change remains.
5. Switch the journey selector to **Python Foundations**. Its tasks, completion counts, and quiz history should remain independent. Switch back to DSA.
6. In **Journey plan**, open an unfinished course lesson and read its content. Choose **Complete module**. Its assigned tasks update without a second manual problem action. **Save note only** should never mark the lesson complete.

## Student: score a real quiz

1. Open **Quizzes**. Choose a covered topic, **Beginner**, and a time limit, then **Start practice**. Questions come from the curated bank, not an AI service.
2. Try **Submit answers** without choosing an answer. The application should ask for at least one answer and show no fabricated score.
3. For an Arrays quiz with the two beginner questions, select **O(1)** for indexed access and leave the other question unanswered. Submit and confirm the skipped answer. The stored result should be **1/2 correct, 50%, 1 skipped**. Other topic/difficulty selections can contain different questions.
4. Review the explanations and open **Progress**. Choose the saved attempt and verify that correct/incorrect/skipped counts agree. Reload and reopen the result.
5. Open **Calendar**. The on-demand practice attempt should not have added a calendar task.
6. Use **Schedule quiz**, select a covered topic and a future time that fits the plan, then save. The new quiz should appear in Journey plan and Calendar. It can be started when eligible; its submitted attempt completes the corresponding task.

## Student: add and publish reusable content

1. Open **Discover**, explore a course, and choose **Add course to journey**. Choose an existing journey or select **Create a new journey** and enter a name. The chosen course's actual items should appear in that plan.
2. Repeat the same course addition. It should not duplicate its items. Explore a published journey and **Adopt this journey**; it receives a separate personal journey ID and source version, even if a title already exists.
   For a course published by an educator on this server, the workspace selector also gains that course. Its discussions, assignments, quizzes, grades, and certificates belong to the course workspace; the personal content copy keeps its adopted version.
3. Open **Practice → Publish a practice sheet**. Enter a title/description and problem lines using the shown `Title | Topic | Minutes | Optional HTTP link` format. Publish and find the sheet in Practice.
4. Open **My journeys** from the account menu, choose **Manage → Publish journey** for a journey with public content. Its completion events, personal notes, dates, and evidence must stay private. Institution or draft-course sources cannot be republished through this flow.

## Student: inspect the annual activity and colorful charts

1. Open **Progress** for DSA. **Learning consistency** shows a full calendar year. Use **Year** to select 2024 and verify that February 29 exists among its 366 day buttons; return to the current year for today's saved work.
2. Select a day to read its event count and estimated completed workload. Tab enters the grid at one selected day; Arrow Left/Right moves one week and Arrow Up/Down moves one day. The detail text follows the focused date. Future dates are distinguished and unavailable.
3. A fresh fixture's sample completion does not light up the annual grid. After a real 25-minute problem completion, its date shows one event and 25 estimated minutes. Submit an on-demand personal quiz: it adds a second event without increasing estimated workload. These are Learnio learning events, not synchronized GitHub contributions.
4. Compare the colored **Planned vs completed workload** bars, **Completion by topic** bars, **Learning mix** donut, and **Quiz performance** donut. Legends state the underlying numbers; topic coverage measures completion, and workload remains estimated content time rather than tracked study time.
5. In the current default database, the learning mix includes **35 course minutes** from a labeled seeded completion plus **25 practice minutes** from the verified browser action. The annual grid excludes that seeded completion. Riya's latest quiz has **1 correct, 1 incorrect, 0 skipped**, so its teal/rose donut is 50/50. These are saved test records, not fixed chart values.
6. Reload and switch Light/Dark. Data and the appearance preference remain saved. At narrow widths, the yearly calendar scrolls inside its own panel while the page stays within the viewport. A journey with no saved activity shows empty days and neutral empty chart states.

## Educator: publish a course and assess work

1. Sign out and log in as `asha_teaches`. My Learning remains available; educator capability adds teaching tools to the same account.
2. Select the personal **Studio**, then **Courses → Create course**. Add a title and description.
3. Open the course, go to **Study material**, and choose **Add lesson**. Supply a title, topic, estimated minutes, description, and lesson content. Save and use **Read lesson** to inspect it.
4. Open the course **Overview → Publish course** and confirm. Switch to My Learning → Discover and search for the title. Public attribution belongs to the educator; institution courses remain private.
5. Select **Northstar University**, then **Data Structures · Section A → Assignments**. Choose **Create assignment**, enter instructions, due date, and maximum points, and save.
6. Sign in as Riya, open the same course/assignment, and **Submit your work** with text and an optional link. Replace the ungraded submission once to exercise version retention.
7. Return as Asha, open **Review submissions → Grade work**. Enter a score/feedback and leave **Release this grade to the learner** unchecked. Save. Riya should still see an awaiting-release state, without the draft score or feedback.
8. Return as Asha and release the grade. Riya can now see the released score and feedback in the assignment/Grades view. Changing a released grade requires a reason and retains grade history.
9. Use course **Discussion** to post a named question/reply. The conversation remains scoped to this course. Schedule an optional **Class** with a date/time and external meeting link; Learnio saves the session but does not host video.

## Import a personal learning plan

1. Open **My Learning → Journey plan → Import plan CSV**. Enter a new journey name and start date. **Download CSV template** provides the supported columns; choose a file under 100 KB or paste CSV text.
2. Start with this content:

   ```csv
   type,title,topic,minutes,url
   lesson,Read about arrays,Arrays,30,https://en.wikipedia.org/wiki/Array_data_structure
   problem,Practice a scan,Arrays,20,
   review,Recall lookup tradeoffs,Arrays,10,
   ```

3. Choose **Preview plan**. Check row validation, 60 minutes of workload, proposed sessions/finish, and any warnings. The preview does not create a journey.
4. Choose **Save imported plan**. The imported journey becomes selected. Verify its items in Journey plan and Calendar; they must start incomplete. Configure availability after import to adjust the default weekly capacity.
5. Preview/import the same title and content again. The original journey should reopen, preserving its ID and work. Changing the start date alone does not create another copy; use a different title for an intentional copy.
6. To exercise a fixed session, add optional `date,startTime,fixed` columns with a future date, `18:00`, and `true`. Fixed sessions need valid dates/times and cannot overlap or cross midnight. Flexible rows leave these blank or set `fixed=false`. Quizzes, completed statuses, institutional enrollments, and arbitrary column mappings are not imported.

## Course quizzes and assessed completion records

1. As Asha, open the public Studio course created above and choose **Quizzes → Create course quiz**. Give it a title, enter a question and four distinct answer choices, select the correct choice, and add an explanation. Choose **Publish quiz**.
2. As Riya, find the published course in Discover and add it to a personal journey. Select that course from the workspace selector, then **Quizzes → Open quiz**. Submitting with no answer should show an error. Select an answer and **Submit answers**, then review the saved score and explanation. If the quiz has multiple questions, skipped questions remain in the denominator.
3. Open **Grades → Course quiz results**. Reload and verify the score remains. Each quiz revision permits one submitted attempt. Official course quiz choices save only on submit; closing an unsubmitted dialog does not save a draft.
4. Return as Asha. **Edit new revision → Publish quiz** creates the next revision; the learner's earlier outcome remains in history, and the new revision permits a new attempt. If you revise it, have Riya pass the current revision before issuing a completion record.
5. Choose **Certificates → Issue completion record** and select Riya/course, then **Check eligibility and issue**. The server requires at least one assessment, at least 60% on every current quiz revision, and a released grade of at least 60% for every current assignment. If you used a course with other unfinished assessments, complete those first. Lesson completion and attendance are not issuance gates in this version.
6. Use **View / print** to inspect the unique serial, issuer, learner, course version, assessment snapshot, and issued state. **Print record** opens the browser print dialog. The record is a local course assessment achievement, not external accreditation or public verification.
7. As Asha, choose **Revoke**, enter **Reason for revocation**, and **Revoke record**. Riya's view must show the revoked state and reason after reloading. This keeps issuance/revocation history rather than deleting the record.

## Administrator: enrollment, groups, and audit

1. Log in as `northstar_admin` and select **Northstar University**.
2. Open **Courses → Create course**. Create a private institution course. Public course publishing remains a personal educator capability.
3. Open **New enrollment → Enroll account**. Choose the course, enter `asha_teaches`, and allocate **Educator**. Enrollment requires an existing account; it cannot grant administrator rights.
4. Choose **Download template**, then **Import enrollment CSV**. Replace the sample username with `riya_learns` and use the new private course's exact ID, with role `student`. Choose **Preview allocations**, review each row, then **Import valid allocations**. Invalid or duplicate rows prevent the entire batch from committing. A repeat preview identifies existing allocations instead of duplicating them.
5. Choose **Export current allocations**. The download contains only this institution's current allocated accounts, with formula-like values neutralized. The export records a durable audit event. CSV intake accepts required `username,courseId,role` columns plus optional display-only `displayName,courseTitle`; imported names never substitute for IDs. XLSX files and account creation during import are unsupported.
6. Open **User groups → Create group**. Add Riya with **Add enrolled member**. Group membership is stored in this institution; the current group feature organizes members rather than defining an arbitrary permission engine.
7. Create a **Department**, **Program**, or **Announcement** using its corresponding page. Reload to verify persistence.
8. Open **Audit log** and inspect the saved actor, action, timestamp, and course/institution scope. Sign in as Riya to confirm the new course and announcement are available within her allocation. An unrelated normal account should not see these private courses, posts, submissions, or grades; server permission checks reject forged course or personal journey IDs.

## Appearance and keyboard/mobile checks

Open **Account settings** and try **Light**, **Dark**, and **System default**. Reload: the choice is retained locally. In System default, the application follows the device preference. Test a narrow viewport, the mobile menu, Tab/Shift+Tab, focus visibility, Escape to close dialogs, and focus return to the initiating control.

See the [validation report](validation_report.md) for the executed automated suites and observed browser checks. The walkthrough is a repeatable exercise script; it is not a claim that every step or production requirement has been browser-verified.

## Run the automated checks

```powershell
npm test
```

The aggregate runs syntax, domain/yearly-activity, client-adapter, chart-calculation, academic-scope, and HTTP/SQLite checks using isolated fixtures. Focused entry points include `node check-model.mjs`, `node check-api-store.mjs`, `node check-charts.mjs`, `node check-academy.mjs`, and `node check-server.mjs`.

## Clean up test data

Stop the walkthrough server with Ctrl+C, then run:

```powershell
node scripts/test-data.mjs clean --db .\data\learnio-walkthrough.sqlite
```

For the main database, use `npm run clean:test-data`. The script removes tagged fixture users, their sessions/personal records, tagged seeded academic records, and new fixture-owned academic records. Tagged test-created grants and references are cleaned up while normal accounts, their independent courses, private journeys, and evidence remain intact.

Cleanup refuses to commit if a non-test academic record depends on a test course/institution; it reports the dependency and leaves the transaction unchanged. Review that record before retrying. The scripts support `seed`, `clean`, and `--db`; they do not provide a dry-run or automatic backup flag. For a backup, stop the server and copy the database files before cleanup. Re-seeding is repeatable and rejects collisions with non-test identities or records instead of overwriting them.

## Current limits

The local server supports the flows above. A live rollout still needs hosting/TLS, tested backup/recovery, email/institution-authority verification, account recovery, and deployment operations. GitHub/LeetCode synchronization, AI generation, binary uploads/XLSX intake, remote notifications, configurable/timed academic assessment policies, public certificate verification, public profile/portfolio publishing, and complete institutional lifecycle policies remain documented follow-on work. Organization workflows stay deferred.
