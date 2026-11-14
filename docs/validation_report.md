# Learnio validation report

Latest validation: **1 October 2026**. This report describes executed checks for the local Node.js/SQLite application, with earlier verification retained as history. It separates automated behavior checks from browser observations and does not certify a production deployment or every future requirement in the blueprint.

## Automated checks

`npm test` completed with exit code **0** after the college workspace, course-description page, and subject-aligned fixture changes. The aggregate command is `node check-demo.mjs` and performs frontend syntax checks followed by the existing model/chart/API/academy/server suites and the new college checks:

| Check | Verified behavior | Result |
| --- | --- | --- |
| `node check-model.mjs` | Identity uniqueness and account scope, persistence/rollback, stable item evidence, quiz answers/scoring, saved drafts, adoption, duration-based scheduling, and stale storage protection | Passed |
| Yearly-activity assertions in `check-model.mjs` | Calendar/leap-year dates, timezone boundaries, owner/journey scope, sample/correction/future exclusions, quiz/evidence deduplication, intensity levels, planned date conversion, and split-session workload across year boundaries/equal timestamps | Passed |
| `node check-api-store.mjs` | Server snapshot replacement, stable client facade, authoritative catalogue, synchronous 366-day activity reader without an HTTP write, cached getter refresh, serialized writes, pending-answer read barrier, workspace payloads, session expiry, failed-write retention, no offline fixtures, and no automatic retry after an unknown write outcome | Passed |
| `node check-charts.mjs` | Empty/full donuts, actual proportional segments/offsets, invalid negative/NaN input, weekly grouping across year boundaries, leap-day totals, and empty weekly series | Passed |
| `node check-academy.mjs` | Membership and teaching scope, denied cross-account operations, named discussion, submission versions, draft-grade secrecy, release corrections, private institution publishing restrictions, global handles, and fixture tagging | Passed |
| Course quiz/completion assertions in `check-academy.mjs` | Hidden answer keys, blank/invalid answer rejection, actual score and skipped denominator, one attempt per revision, preserved earlier outcomes, assessment eligibility, unique serials, revocation history, and revoked membership access | Passed |
| `node check-server.mjs` | Real HTTP/SQLite persistence, password sessions and isolated accounts, response privacy, server scoring, source validation, same-origin/Host checks, static-file isolation, opt-in fixtures, collision refusal, and targeted atomic cleanup | Passed |
| `node check-college.mjs` | Semester rollover, selective enrollments, metadata-only college catalog, private publication boundaries, official profile permissions, campus/personal event isolation, targeted notices, read state, archive history, and revoked access | Passed |
| `node check-college-ui.mjs` | Actual rendered semester filters, curriculum/instructor/duration totals, privacy controls, valid routes without a journey, scoped schedules, minimal month grids, notice filters, and form-to-backend contracts | Passed |
| `node check-persona-data.mjs` | Intensive subject-specific college curricula, quizzes and workflow states, daytime classes without holiday overlap, seed repeatability, retained identities, profile/read-state cleanup, backups, and dependency rollback | Passed |
| CSV assertions in `check-server.mjs` | Quoting/newlines, formula-safe export, enrollment scope/duplicates/errors, atomic import and idempotence, audited export/import round trip, non-saving personal plan preview, incomplete imported items, fixed-session warnings, malformed input, and repeated-plan reuse | Passed |

The suites create isolated fixtures. They do not depend on the main browser walkthrough database. The API adapter check uses a controlled browser-like VM; the server check starts an actual HTTP server against temporary SQLite storage. These checks are not a load test, a full security audit, or a browser automation suite.

## Browser observations

The following interactions were observed during this delivery against the running application:

| Flow | Observed outcome |
| --- | --- |
| Login and registration screens | Desktop and narrow layouts render, with accessible form labels and the three opt-in test credentials visible. Student login succeeds. |
| Exact problem completion | Contains Duplicate opens the correct item; manual completion saves evidence and remains after reload. |
| Journey isolation | Switching from DSA to Python changes the selected journey's work without copying the DSA completion. |
| Personal quiz | Blank submission is rejected. One correct answer and one skipped question produce **1/2, 50%, 1 skipped**, with saved review and Progress. |
| Course discussion and assignments | Student discussion/submission and educator grading were exercised across separate account logins. |
| Educator authoring | Course/lesson creation and public course publication were exercised. |
| Personal plan CSV | Unsupported `practice` type blocks save. A valid lesson/problem plan previews **35 minutes, 2 sessions**, then saves a new journey at **0% complete** with 18:00/18:20 allocations. |
| Public course adoption | Riya adds Asha's published course through Discover into a new journey and receives the course learner workspace in the same saved operation. |
| Official course quiz | Asha creates a one-question MCQ. Riya answers it for **100%**; the saved result remains in course Grades after reload. |
| Completion issuance | Asha issues an eligible course assessment completion record with an issue date and unique serial. |
| Administrator CSV preview | Existing Riya/Asha allocations produce **0 new, 2 existing, 0 errors**. The no-op import button remains disabled. |
| Institution group and audit | An administrator creates a group; Audit log shows the `createGroup` action, actor, and timestamp. |
| Mobile calendar | The calendar at a 390-pixel viewport has no horizontal page overflow. |
| Appearance | Light and Dark preferences remain after reload. Final Dark verification at 390 × 844 showed a 390-pixel document and 375-pixel content width without horizontal overflow. |
| Mobile keyboard navigation | Opening the drawer isolates main-page focus. Escape closes it and returns focus to **Open navigation**. |
| Narrow registration | At 320 × 740, a body minimum-width rule caused scrollbar-related horizontal overflow. After removing it, the reloaded Dark registration page showed all labeled fields with document `clientWidth = scrollWidth = 305`; no horizontal overflow remained. |
| Revised login/registration appearance | Light/Dark controls preserve typed form values. Test credentials are under **Try a test account** and the primary login button is **Log in to Learnio**. Final 320-pixel registration checks in both themes show all five labeled fields and equal client/scroll width of **305**. |
| Today | The redesigned hero reflects actual saved task completion. |
| Annual activity | A real 25-minute completion produces **365 day cells, 1 event, 25 estimated minutes** for the current year. Selecting 2024 gives **366 cells including February 29**. |
| Annual keyboard interaction | Arrow Left moves seven days, updates day details, and preserves one grid tab stop. |
| Quiz and activity agreement | A quiz with **1 correct and 1 incorrect** produces **50%** and adds the second annual event while total estimated activity workload stays **25 minutes**. |
| Colorful saved charts | The learning-mix donut shows **35 course minutes and 25 practice minutes**; the quiz donut shows teal/rose **50/50** segments. Charts and theme persist after reload. Seeded course completion is included in the mix but excluded from annual activity. |
| Final narrow Progress layout | At 390 pixels, page client/scroll width is **375/375**, while the annual calendar scrolls internally at **305/885**. At 320 pixels, page client/scroll width is **305/305**, calendar **243/885**. Only the chart scrolls horizontally. |

The [walkthrough](demo_walkthrough.md) includes additional reproducible scenarios. Browser checks for registration submission, committing a new enrollment CSV batch, quiz revision, certificate revocation/print output, System theme response, and full keyboard/screen-reader coverage must be recorded when executed; automated coverage alone is not a claim that those browser scenarios passed.

## Fixture lifecycle and current handoff

After the initial application verification, the default server was stopped before running `npm run clean:test-data`. Cleanup completed with exit code **0**, removing **3 fixture accounts and 22 academic records**. `npm run seed` then completed with exit code **0**, creating **3 fixture accounts and 5 academic records**. This confirmed the real default-database cleanup/reseed flow and restored its baseline at that point.

The subsequent screenshot-directed theme and chart verification deliberately leaves Riya's **one problem completion and one 50% personal quiz** saved under the tagged test account so the charts display observed learning activity. The same targeted cleanup script removes that account and its personal records. The server is running at [http://127.0.0.1:4173](http://127.0.0.1:4173); all three test credentials remain available. The temporary viewport override was reset and the student's **Progress page in Light mode** left open for handoff. Browser views were inspected during verification; no exported image file is claimed.

The earlier copy/navigation edits passed syntax validation; the latest aggregate suite passed after the final functional chart changes. Subsequent CSS cleanup removed unused `progress-ring`, `activity-grid`, and `activity-cell` rules with no JavaScript references. The final narrow-layout observations above verify the active chart layout.

The current port-4173 browser error log is clean. The retained error history contains only earlier port-3000 errors recorded during an in-progress edit.

## College workspace and course-page browser checks — 1 October

Executed against an isolated database at port 4174; the main port-4173 database was preserved and its server restarted with the updated code.

- Student college overview showed four current enrollments and 14 credits. The complete college catalog showed eight offerings, with the unallocated elective exposing an outline and no course-entry action.
- A private student reminder saved and remained after reload; it disappeared from Campus calendar. An administrator-created campus event appeared in the shared view.
- Administrator profile editing saved a changed student section. A student-targeted announcement was hidden from the educator; the educator’s publishing form offered only allocated courses.
- Opening a notice marked it read and removed it from the Unread filter. Search/category/archive controls were also covered by the real UI rendering checks.
- Database Design displayed Asha Rao, four subject-specific modules, a three-hour lesson estimate, and five assessments. The first lesson opened its actual relational-model content, and the SQL-joins module expanded through its native disclosure.
- College notices and course pages fit 320px and 390px viewports without horizontal body overflow. Both appearances were inspected; the browser error log was empty.

Screenshots are saved in `tmp/ui-snapshots/college-overview-light.jpg` and `tmp/ui-snapshots/college-course-light.jpg`. The updated persona seed/cleanup script was exercised only on isolated databases during this change.

## Deployment boundaries

- Internet hosting/TLS, deployment hardening, backups/recovery, email and institutional-authority verification, and account recovery are not configured.
- Storage uses one serialized aggregate in SQLite for one local server. Multi-process concurrency and sustained load have not been tested.
- Personal quiz autosave/timing and official course quiz policies differ. Official quiz choices save on submission and allow one attempt per revision; there is no academic draft autosave/timer.
- Completion records verify local assessment thresholds at issuance. They have an explicit revocation history, without external accreditation or a public verification endpoint.
- GitHub/LeetCode synchronization, AI generation, binary uploads/XLSX intake, remote notifications, public portfolios, complete role/graduation lifecycle, and private course-to-personal synchronization remain future work.
- The historical blueprint PDF was not regenerated. The Markdown blueprint, README, walkthrough, and this report describe the delivered application.
