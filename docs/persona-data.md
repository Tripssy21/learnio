# Persona cleanup and intensive test data

Run from the project directory with Node 24 or newer:

```powershell
npm run personas:clean
npm run personas:seed
```

Run either command independently. Cleanup retains the three accounts, passwords, personal profile settings, educator capability, and minimal Northstar membership needed for persona access. It removes their academic profile details, notice read states, semesters, campus dates, personal reminders, journeys, notes, schedules, quiz attempts, completion evidence, drafts, enrollments, courses, assignments, submissions, grades, discussions, classes, publications, certificates, and institution records. The Northstar name and role memberships remain so the administrator can still manage the institution. Other accounts are retained. A dependency from non-test work prevents the reset with no database changes.

Seeding replaces the personas' related data with a fresh comprehensive fixture; it does not append duplicates. Existing credentials are preserved. Missing persona accounts are created with password `demo123`:

| Persona | Username |
| --- | --- |
| Student | riya_learns |
| Educator | asha_teaches |
| Administrator | northstar_admin |

Every successful command writes a consistent pre-change state export beside the database (`*.persona-backup-*.json`). Treat backups as private: they include account records and password hashes. These are state exports, not complete SQLite/session backups. Persona sessions are invalidated, so refresh and sign in again after running a command.

Default database: `data/learnio.sqlite`. Override with `LEARNIO_DB` or:

```powershell
npm run personas:seed -- --db C:\path\to\learnio.sqlite
npm run personas:clean -- --db C:\path\to\learnio.sqlite
```

## Data coverage and walkthrough

- Each persona: three journeys, a 96-item engineering lab, 72 dated completions across twelve weeks, notes and resource URLs, future scheduled work, scored personal quizzes, and a saved creation draft. The engineering lab is selected for calendar/chart testing.
- College: three academic terms (completed Spring, current Monsoon, upcoming Spring), eight private college offerings, two departments, and a B.Tech program. Riya has four current courses worth 14 credits, two past courses, and one upcoming enrollment. The Machine Learning elective is visible in the college catalog but its lessons, class, assessments, and targeted notice require enrollment.
- Student: open the college overview and academic profile; verify the roll number, program, department, section, advisor, and admission year. **Courses** starts with current enrollments; choose another semester or **College catalog** to browse offerings. Open the seven allocated courses to inspect instructors, curriculum, materials, discussions, assignments, course quizzes, grades, feedback, classes, and two completion records. Submit the pending Python Engineering deliverable and take the unanswered Algorithms Lab quiz. Inspect the failed Software Testing quiz and revoked Capstone completion record.
- Educator: review the ungraded Database Design submission, release the draft Web Systems grade, inspect grade correction history, reply to student discussions, revise a quiz, schedule a class, and inspect the active/revoked certificates. Public Python practice is published for discovery and adoption. A practice sheet and three contributed journeys populate the public catalogue.
- Calendars: four shared campus events cover a holiday break, research event, examination window, and elective registration. Each persona also has a private reminder. **My schedule** includes allocated classes, assignment deadlines, campus dates, and only your reminders. **Campus calendar** shows shared events. Classes run during 09:00–17:00 India time and avoid the seeded campus holiday. Create a reminder, reload, and confirm it remains private when switching accounts.
- Announcements: thirteen notices populate academic, examination, fees, scholarships, placements, and campus categories. Audiences include the campus, students, faculty, a program, a department, and individual courses. Open a notice to mark it read, search by office/reference, filter unread notices, and inspect expired/archived circulars. Asha can publish only to her allocated courses; Maya can publish campus-wide notices.
- Administrator: inspect academic profiles, semesters, two departments, a program, four groups, course allocations, campus dates, targeted announcements, and the audit trail. Edit a student’s academic record from **Students → Edit profile**. Add a course with code, credits, department, program, and semester, then enroll the existing student and educator. Changing the current semester moves the previous term to completed without deleting enrollment history.
- All descriptive content, material bodies, notes, evidence links, assignment instructions, submitted responses, grade feedback, quiz explanations, and class links have test values. Empty values that encode a legitimate workflow state remain empty: pending completion timestamps, ungraded scores, root reply parents, public-course institution IDs, and active-certificate revocation fields. This allows testing pending and completed states without inventing invalid records.
- Classroom URLs use `example.test` and do not represent a real meeting service. Resource links point to official documentation relevant to each subject. Activity is explicitly synthetic local QA history, not externally verified learning.

These commands do not run automatically on application startup. The older `clean:test-data` command deletes the persona accounts as well; use `personas:clean` to retain them.

Validation: `node check-persona-data.mjs` or `npm test`. Tests use temporary databases and never reset your current application data.
