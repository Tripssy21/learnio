# Learnio

The complete application is in `lernio/` under the parent project. Run the commands below from this folder. Development rules are in [AGENTS.md](AGENTS.md); the current completeness and security review is in [security_best_practices_report.md](security_best_practices_report.md).

A self-hosted learning application with persistent accounts, connected personal learning, educator tools, and scoped institution coursework. The responsive interface uses screenshot-directed light/dark surfaces, green learning accents, colorful data charts, and vanilla HTML, CSS, and JavaScript. A Node.js server stores application records and sessions in SQLite; there are no third-party runtime dependencies or frontend build steps.

## Run locally

Install Node.js **24 or later**, then run from this directory:

```powershell
npm start
```

Open [Learnio](http://127.0.0.1:4173). The server listens on loopback and creates `data/learnio.sqlite` on first use. A new database starts with no accounts: choose **Create account** to begin. A static file server or opening `index.html` directly cannot run the application.

To choose another database or port:

```powershell
node server.js --port 4173 --db C:\path\to\learnio.sqlite
```

`PORT` and `LEARNIO_DB` environment variables provide the same configuration. Keep the SQLite database to retain records across server restarts; browser site data is no longer the learning-data store.

## Hosting on Render

The repository includes `render.yaml`. After pushing it to GitHub, open the Render dashboard, choose **New → Blueprint**, and connect this repository. Review the paid 0.5 CPU / 512 MB service and 1 GB persistent disk before deploying. The Blueprint sets the Node version, host, database path, health check, and commands listed below. The server automatically uses Render's assigned `RENDER_EXTERNAL_URL` as its public origin; no placeholder URL needs to be entered. Open the resulting Render URL once deployment is live. Pushing this file does not create a Render service or activate a backend on the existing Netlify site.

For manual setup instead of a Blueprint:

Create a Node web service from this repository's `main` branch. Leave the root directory blank when `package.json` is at the repository root. Set the build command to `npm test`, the start command to `npm start`, and the health check path to `/api/health`.

Attach a persistent disk to a paid service at `/var/data`, then set these environment variables:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `HOST` | `0.0.0.0` |
| `LEARNIO_DB` | `/var/data/learnio.sqlite` |
| `PUBLIC_ORIGIN` | Optional override for the automatic Render URL; use the exact HTTPS origin for a custom domain |

`PUBLIC_ORIGIN`, when set, must not include credentials, a path, query, or fragment. The server accepts that host, enforces the configured origin on mutations, and marks HTTPS session cookies Secure. It does not trust forwarded host/protocol headers. Without hosting configuration, the server retains its loopback defaults. Serve the frontend and API together from the Render URL.

The hosted database starts empty; local records are not uploaded by Git. Only database files on the mounted disk persist across restarts and redeploys. Keep one application instance with this SQLite storage model. Verify `/api/health`, account creation/login/logout, and saved work after a restart. Set up consistent SQLite backups and test recovery separately; persistent storage alone is not a backup or a production-readiness guarantee.

## Optional test accounts

Test accounts are created only by the explicit seed script:

```powershell
npm run seed
```

| Account | Username | Password | Available context |
| --- | --- | --- | --- |
| Student | `riya_learns` | `demo123` | Personal journeys and enrolled coursework |
| Educator | `asha_teaches` | `demo123` | My Learning, Studio, and assigned teaching |
| Institution administrator | `northstar_admin` | `demo123` | Institution administration and personal learning |

These credentials are public test fixtures, not automatically created production users. The seed/cleanup workflow targets tagged fixture data, including new academic records created by those test accounts. Remove seeded fixtures with:

```powershell
npm run clean:test-data
```

On the login page, expand **Try a test account**, or enter a username/password and choose **Log in to Learnio**. Light/Dark/System appearance controls are also available before login and preserve entered form values. The current default test database retains Riya's completion and quiz from the chart verification so the colored charts have saved activity to display; the cleanup command removes that test account's records.

For a separate test database, use `node scripts/test-data.mjs seed --db C:\path\to\test.sqlite` and the matching `clean --db` command, then start the server with that database. Cleanup preserves normal users' private records and refuses to commit if non-test academic work depends on a fixture course/institution. See the [step-by-step walkthrough and cleanup guide](docs/demo_walkthrough.md) for an isolated setup, role journeys, and the exact cleanup boundary.

Usernames share one case-insensitive namespace in the server database; display names may repeat. Educator capability adds teaching tools while preserving personal learning. Institution membership grants scoped access and does not create another personal identity.

## What is connected

- Journey-specific content, allocations, completion evidence, and quiz attempts drive Today, Journey plan, Calendar, Quizzes, and Progress.
- Journey plan uses selectable weekly checkpoints, grouped course/practice/quiz summaries, previous/next week navigation, and a Detailed plan toggle for the seven-day schedule. Calendar days open full task lists and use the same activity colors as the daily task cards.
- Progress starts Quiz performance with All quizzes: correct, incorrect, and skipped answers are summed across submitted quizzes in the selected journey. The dropdown selects an individual quiz result; changing journeys resets to the aggregate.
- Journey plan imports personal lesson/problem/review CSV files through a non-saving preview and atomic commit, with duration-based scheduling, fixed-session validation, and repeat-import protection. Imported items start incomplete.
- Discover and Practice open content details and save course/sheet references to the chosen journey. Adoption copies a version-attributed template into a distinct personal journey; duplicate additions do not duplicate completed work.
- Exact lesson/problem actions open the selected item. Manual completion and lesson completion save source-labeled evidence. Notes remain separate from completion; corrections retain evidence history.
- Quizzes use a curated question bank. Answers persist on the server, are scored there, and include skipped answers in the denominator. In-progress responses do not contain answer keys. Practice attempts do not add calendar work; explicitly scheduled quizzes do.
- Progress includes a full-year learning activity grid with year selection, leap days, intensity levels, day details, and arrow-key navigation. It counts real saved completions and submitted personal quizzes in the account timezone, excluding seed examples and corrected completions. Optional quizzes add an event without invented workload minutes.
- Colorful quiz and workload donuts, topic bars, and weekly planned/completed comparisons use saved quantities with textual summaries and neutral empty states. Workload is estimated content time. Other completion/workload charts retain labeled fixture progress; the annual activity and completed weekly activity exclude seeded examples.
- Studio supports educator-owned courses, lesson materials, and public course publication. Students and educators can publish reusable journeys and practice sheets. Private institution content cannot be republished through a journey.
- Adding a published educator course grants its learner workspace as well as version-attributed personal content. Its discussion, assignments, official quizzes, grades, and completion records stay in that course context.
- Institution tools use server-side membership/course checks for enrollment, teaching, named discussion, assignments, submissions, grading and release, classes, groups, announcements, academic structure, and audit records. CSV enrollment preview/import is atomic; authorized exports use formula-safe cells and record an audit event.
- College workspaces distinguish institutional offerings from each member’s enrollments. Current-semester courses are active by default; semester filters retain past and upcoming allocations. Private college courses never enter the open Discover catalog. Course pages show saved instructors, topic modules, lessons, estimated study time, and assessments.
- Academic profiles hold college-maintained roll/staff numbers, program, department, semester, admission year, section, and advisor. Administrators manage academic terms and profile records independently of course enrollment.
- College calendars combine allocated classes and assignment deadlines with shared holidays/academic dates and private reminders. The campus view shows shared dates only. Noticeboards support categories, issuing offices, circular references, audience targeting, priorities, resource links, expiry, read state, and archived history; educators address their allocated courses.
- Course educators author four-choice quizzes with one saved attempt per learner per revision. Server scoring hides keys before submission, retains earlier outcomes after revision, and counts skipped questions in the denominator.
- Educators issue uniquely numbered course assessment completion records after the learner earns at least 60% on every current released assignment and current course quiz revision. Issued records retain the assessment snapshot, support view/print, and show revocation with a reason.
- Account settings provides identity/profile editing, educator capability, and System, Light, and Dark appearance. Only the appearance preference remains browser-local.
- Navigation, cards, forms, dialogs, and calendar views support desktop and narrow screens, with labeled SVG icons and keyboard focus treatment.

## Persistence and boundaries

For complete college test coverage, run `npm run personas:seed`; to remove related data while retaining persona identities, run `npm run personas:clean`. Both commands save a pre-change state export and require signing in again. See the [persona data guide](docs/persona-data.md) for coverage and a repeatable walkthrough.

The noticeboard organization draws on official [IIT Bombay announcements](https://www.iitb.ac.in/announcements), [NIT Trichy academic notices](https://www.nitt.edu/home//academics/notices/%2Bview), [IIM Ahmedabad announcements](https://iima.ac.in/the-institute/announcement), and [IIIT Hyderabad academic calendars](https://www.iiit.ac.in/academic-calendar/). Course descriptions use the instructor, skills, and module structure of [Coursera’s Algorithms Part I](https://www.coursera.org/learn/algorithms-part1) as a design reference; all displayed college content comes from Learnio records.

Account and learning records are stored in SQLite. Passwords are salted PBKDF2 hashes. Login creates a 24-hour HttpOnly, SameSite session cookie; session tokens are stored as hashes. The server checks the session and scope for mutations and returns an account-scoped snapshot. The client serializes writes and keeps its last confirmed records if a request fails. After an interrupted write with an unknown result, reload records before retrying.

This is a functional local server application, not a configured internet deployment. TLS hosting, automated backups/recovery, email ownership and institutional-authority verification, password recovery, and a production operations plan remain required before a live rollout. The storage implementation serializes a single JSON aggregate in SQLite; multiple server processes and high-concurrency deployments need a stronger persistence design.

GitHub/LeetCode synchronization and AI generation are not connected. External links and manual evidence never imply a verified judge result. Binary uploads/XLSX intake, remote notifications, configurable assessment policies, public certificate verification, and the remaining roadmap workflows require further work. Official course quizzes save answers only on submission, with no timed draft/autosave flow; completion records are local assessed achievements, not external accreditation. Institution lessons remain inside their authorized course; copying private institution materials into My Learning is deferred. Institutions do not publish public courses; no organization module is introduced.

## Checks

Run the application checks with Node.js 24+:

```powershell
npm test
```

The aggregate includes `node check-model.mjs`, `node check-api-store.mjs`, `node check-charts.mjs`, `node check-academy.mjs`, and `node check-server.mjs`. `learning-charts.js` holds the dependency-free chart calculations; `charts.css` provides their presentation. These files are served through the existing static allowlist. Checks use isolated fixtures. See the [validation report](docs/validation_report.md) for executed checks, observed browser flows, and remaining verification boundaries. Passing the application checks does not close every future production gate.

## Product baseline

[The functionality and roadmap blueprint](docs/weStudy_functionality_and_roadmap.md) records agreed product rules, implementation status, reviewable recommendations, and remaining production gates. Its original filename is retained for existing links. The [PDF](output/pdf/weStudy_functionality_and_roadmap.pdf) is the historical 1.0 snapshot: it has **not** been regenerated for this Learnio implementation. The Markdown is current. `PRODUCT_FEATURES.md` is retained only as historical context where it conflicts with the blueprint.
