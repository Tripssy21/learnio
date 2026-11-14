# Learnio
## Product functionality & user journey blueprint

**From a sidebar prototype to one home for learning and teaching**

Version 1.1 | 30 September 2026 | Product baseline and server implementation status

For students, educators, and institutions. Covers the implemented local application, agreed product rules, recommended adjustments, future modules, user journeys, and delivery gates.

> North star: Give every person a lasting record of what they learn, teach, create, and offer, while giving institutions a shared place to deliver education and track the work within their scope.

This is a product and delivery plan. The present application runs a local Node.js server with SQLite persistence, authenticated sessions, connected personal learning, and scoped teaching/institution operations. It is not yet configured for an internet production rollout. Proposed behavior is not a claim that every integration or roadmap workflow exists. The original Markdown filename is retained for existing links. The accompanying PDF remains the historical 1.0 snapshot and has not been regenerated; this Markdown is the current baseline.

## Implementation update: 30 September 2026

The Learnio delivery replaces disconnected fixtures with shared domain records in `learning-store.js`, a session-authenticated SQLite backend in `server.js`, an API adapter in `api-store.js`, and scoped academic operations in `academy.js`. `app.js` and `academy-ui.js` present those records; `learning-charts.js` and `charts.css` provide data-driven chart calculations and presentation. The following matrix describes the implemented boundary; it does not close every production release gate.

| Area | Current delivery | Remaining boundary |
| --- | --- | --- |
| Brand and UI foundation | Learnio branding, screenshot-directed light/dark surfaces with green accents, colorful data series, remembered System/Light/Dark preference on login and in settings, SVG icons, responsive navigation/forms | Browser accessibility and layout verification are required for changes; a polished UI does not prove backend readiness. |
| Login and registration | Server registration, normalized unique usernames, separate display names, educator capability, password hashing, and HttpOnly sessions | Email ownership/authority verification, recovery, and internet deployment remain operational work. No accounts are seeded by default. |
| My Learning records | SQLite-backed content membership, journey tasks, evidence, and attempts feed all learning pages through account-scoped snapshots | Backup/restore, multi-process concurrency, and deployment operations still need production work. |
| Planning and discovery | Item details, saved additions, distinct version-attributed adoption, persisted setup, duration-based scheduling, and validated personal CSV import with repeat-import protection | Advanced planning, official cohort-to-personal synchronization, XLSX intake, and richer import mapping remain later work. |
| Completion and evidence | Exact item actions, manual problem and lesson completion, source labels, corrections, and derived summaries | No GitHub/LeetCode synchronization or independent judge verification. |
| Quizzes and progress | Curated personal practice, server-saved responses/scoring, hidden keys before submission, attempt history, scheduled practice, annual activity grid, colorful answer/workload donuts, topic bars, and weekly workload comparison | No AI generation; measured focus time, advanced analytics, and configurable assessment policies remain later work. |
| Account surfaces | Account settings, local theme preference, capability management, private profile/portfolio surfaces, and journey management | Public profile hosting, reputation, remote account lifecycle, and authority verification remain further work. |
| Studio and course delivery | Educator course creation, lessons, publication, public learner workspaces, classes, discussion, assignments, grading/release, revisioned MCQ assessment, and completion-record issuance/revocation | Full content-version lifecycle, binary uploads, timed academic attempts, configurable assessment policies, and public certificate verification remain later work. |
| Institution | Institution creation, username reservation, scoped course/enrollment/group actions, CSV preview/atomic intake and audited safe export, structure, announcements, and durable administrative audit | Authority/domain verification, XLSX intake, invitations, complete role lifecycle, and reporting policies remain later work. |
| Reusable contributions | Student/educator journey and sheet publication; version-attributed adoption; private-origin publication guard | Public review eligibility, moderation, update offers, and rights workflows remain further work. |
| Test data and verification | Explicit `scripts/test-data.mjs seed`/`clean`, model/API/server checks, and browser checks | Fixture accounts are opt-in. Test results must be reported after execution; no inventory row closes an entire production gate. |

## Delivery decisions

- Keep the dependency-free HTML/CSS/JavaScript frontend and use Node.js 24's built-in HTTP and SQLite capabilities for a functional local server. There is no automatic external deployment.
- Reserve usernames case-insensitively across personal and institution accounts in the server database. Preserve display-name freedom and treat educator as a capability, not a login persona.
- Persist domain records and hashed sessions in SQLite. Passwords use salted PBKDF2. Browser local storage holds only appearance preference; a failed API does not fall back to disconnected demo records.
- Start new databases without fixture users. Use explicit tagged seed/cleanup scripts for the three published test credentials. Cleanup is not a general database reset.
- Count each included learning item equally for personal journey completion and label workload minutes as estimates. Course assessment completion is separate: at least 60% on every current released assignment and current quiz revision, with at least one assessment required. Lesson completion is not an issuance gate in this version.
- Use a curated question bank with explicit provenance. Do not present it as AI generation. Connections show their unavailable state and do not invent external evidence. Scoring and answer keys stay on the server until submission.
- Derive annual activity from the selected journey's real saved completions and submitted personal quizzes, using account-timezone dates. Exclude seeded examples and corrected completion records, deduplicate scheduled quiz evidence, and cap split-session workload across the full item history. On-demand practice adds an event without estimated workload. Existing fixture completion/workload totals remain visible elsewhere with sample provenance.
- Separate personal practice from educator-authored course quizzes. Course quizzes allow one submitted attempt per revision, require at least one answer, and count skipped questions in the denominator. Revising a quiz preserves the prior attempt; current keys remain hidden from learners until submission.
- CSV enrollment accepts existing usernames, explicit course IDs, and learner/educator roles only. Validate the entire file again before atomic commit; duplicates or invalid rows cannot partially grant access. Administrative exports are scoped, audit-recorded, and formula-safe.
- Keep institution membership distinct from identity, public courses educator-owned, and organization workflows deferred. Server checks enforce account/course scope; an institution created locally is not automatically verified as an external authority.
- Keep later recommendations and production acceptance gates below as backlog. Implemented server workflows do not by themselves satisfy hosting, recovery, scaling, or every institutional policy requirement.

<!-- page -->
# 01 | How to use this blueprint

## One product, three perspectives
Learnio should connect personal learning, independent teaching, and university coursework through a persistent identity. A student can plan learning, solve problems, publish reusable journeys, and build a portfolio. An educator has those learning capabilities plus tools to publish courses and teach learners. An institution manages membership, academic structure, course delivery, and reporting through permission-scoped staff accounts.

The long-term outcome is continuity: a learner keeps their personal identity and record when they join or leave an institution; an educator keeps an independent profile and teaching record while holding one or more affiliations. Institutional records remain governed by the institution's access rules.

## Status legend used throughout
| Label | Meaning |
| --- | --- |
| Local interaction | A control changes local navigation or transient UI state; persistence is not implied. |
| Implemented on local server | Records are saved in SQLite with authenticated and scoped API access. Internet deployment, integrations, and broader workflows are not implied. |
| UI sample | A page, chart, status, or result is present with fixed sample data. It does not demonstrate an operational workflow. |
| Agreed rule | A product behavior established in the conversation, including rules not yet built. |
| Recommended design | A concrete proposal in this blueprint to complete the flow or resolve an inconsistency. It remains reviewable. |
| Deferred | Deliberately outside the current release or awaiting a later scope discussion. |

## Reading and delivery approach
Read the current implementation inventory before treating any screen as finished. Then use the module specifications and journey walkthroughs as the functional backlog. Release phases describe dependency order and completion gates, not dates or commitments to a fixed team size.

Each module should be discussed and refined using its fields, actions, transitions, permissions, and acceptance checks. A module is production-ready only when its UI, stored data, authorization, failure behavior, and verification all agree.

## Scope of the requested adjustments
This document records both the specification and the current implementation boundary. Shared learning records, item-specific navigation, evidence provenance, account settings, and a first teaching/institution workflow now use the server. Institution authority verification and broader rollout policy remain future work. These changes keep the established sidebar structure while connecting the core learning and teaching flows.

> Decision precedence: the latest user decisions take priority over legacy PRODUCT_FEATURES.md wording. The 1.1 inventory covers the frontend, server, shared domain store, academic module, test-data scripts, and behavior checks. Sections describing future acceptance remain requirements, not delivered claims.

<!-- page -->
# 02 | Agreed product rules

## Identity and ownership
- Use one globally unique username namespace across students, educators, institutions, and any later organization account. Display names may repeat. Do not add a persona dropdown to login.
- Student and educator are account capabilities configured in account settings. Educators can learn and teach. Affiliated and independent educators are not separate personas.
- Workspace switching changes the working context, not the person's identity. An institution role is a scoped authorization grant rather than a new personal identity.
- A person's independent portfolio and record survive an affiliation ending. Institution-owned material and private records do not automatically become public or personally owned.

## Content and discovery
- A journey combines courses, practice problems or sheets, and optional quizzes. Learners can create custom journeys or adopt published ones.
- Educators publish courses. Institutions currently help identify affiliated educators and manage academic delivery; they do not directly publish public courses.
- Students who publish journeys are student contributors. Educators and students may publish standalone practice sheets. Do not invent a separate community-creator persona.
- Courses, journeys, and educators can have ratings and reviews. Affiliation should be visible without implying institutional endorsement of every independent offering.

## Navigation and execution
- My Learning has a selected journey and seven pages: Today, Journey plan, Calendar, Discover, Practice, Quizzes, Progress.
- Journey plan is for planned content, order, and schedule. Performance charts live in Progress, accessible through navigation.
- Discover searches courses and journeys. Practice is a separate discovery catalogue for sheets, including company and topic combinations.
- Topic and institution filters use searchable checkbox selection; Practice additionally offers searchable company selection. Publisher options include Educator and Student contributor where applicable.

## Completion and institution behavior
- Problem navigation can open NeetCode; a mapped GitHub solution may supply completion evidence. Manual marking is also allowed.
- Completing the day's assigned course module completes the matching daily task automatically.
- Institution email linking enables the relevant institution experience. User-group permissions control available actions. Discussions are course-specific and use named identities.
- Institutions need new enrollment, group allocation, role import/export, live access changes, and logged administrative changes.

**Deferred:** Organization structure and workflows will be discussed and frozen last. This document does not finalize them or introduce them into the current navigation.

<!-- page -->
# 03 | Workspace and sidebar contract

## Preserve the established structure
| Context | Sidebar sections and pages |
| --- | --- |
| Student or educator: My Learning | Plan: Today, Journey plan, Calendar. Explore: Discover, Practice. Review: Quizzes, Progress. |
| Student: institution | Context selector for enrolled courses. Above Institution, the selected course exposes Overview, Study material, Discussion, Assignments, Quizzes, Grades, and Certificates. Institution exposes Overview, Courses, Calendar, Announcements. Past-course policies remain backlog. |
| Student: public educator course | Adopting published course content grants its course workspace, with Overview, Study material, Discussion, Assignments, Quizzes, Grades, and Certificates. |
| Educator: personal Studio | Dashboard, Courses, Classes, Learners, Certificates. Selected course tools belong inside the course context. |
| Educator: institution | Dashboard, My teaching, Calendar, Announcements, Institution resources. Selected course adds the seven course pages above the institution section. |
| Institution administrator | Dashboard, New enrollment, User groups, Students, Educators, Departments, Programs, Courses, Classes, Calendar, Announcements, Reports, Audit log, Settings. Course context adds the seven course pages. |

## Recommended account menu
Make the existing account area actionable. Put Public profile, Portfolio, My journeys, Account settings, Connections, Notifications preferences, and Sign out here. My journeys is the place to rename, duplicate, pause, archive, and manage journeys across the account. It does not become another page inside the selected journey's plan.

Account settings holds educator capability changes and identity information. Public profile is a read-facing identity page; Portfolio is its editable collection of selected artifacts. Connections is the account-level place for external authorization; Today may show a small connection status or repair link.

## Context rules
- All task and item links carry a journey or course identifier, an item identifier, and a return destination. A course lesson arrow opens that lesson, not the catalogue or general planner.
- Changing journey refreshes its schedule, attempts, evidence, and Progress. Search may retain catalogue preferences, but completion records must never bleed across journeys.
- Show the active institution and course on academic pages. Links into a different workspace should land in that context with a clear breadcrumb and a return action.
- Course tools appear only for an eligible selection. Past courses are read-only where policy allows; removed access shows a clear explanation instead of an empty or misleading page.

**Acceptance:** Switching from DSA Interview Prep to Python changes every journey-specific page. Switching workspaces never changes username, persona, or unrelated permissions.

<!-- page -->
# 04 | Current implementation: My Learning

| Area | Implemented | What remains |
| --- | --- | --- |
| Today | Tasks from the selected journey's saved schedule; exact item/resource actions; derived daily counts; saved manual and lesson-completion evidence. | External evidence integration and a richer learning player. |
| Journey plan | Saved content references, journey setup draft, duration-based timeline, availability configuration, quiz scheduling, and personal CSV import with preview, fixed/flexible sessions, and repeat-import protection. | Production cohort sources, advanced planning/revision controls, XLSX files, and arbitrary import mapping. |
| Calendar | Saved allocations shared with Today and Journey plan; month navigation, open days, filters, item actions, and mobile agenda. | Full partial-slice semantics and the remaining production scheduling policies below. |
| Discover | Starter and published course/journey catalogue, search/checkbox filters, item details, stored additions, and distinct version-attributed adoption. | Eligible reviews, advanced discovery, and full content-version lifecycle. |
| Practice | Starter and contributor sheets, searchable filters, exact problem references, saved additions, and sheet publication. | Reliable company-tag provenance, moderation, and advanced authoring. |
| Quizzes | Curated bank, covered-topic choices, timed attempts, server-saved answers/scoring, review, and history. Planned quizzes use explicit allocations. Official course quizzes live in their course workspace. | AI generation, question moderation, and scheduled background generation. |
| Progress | Completion/estimated-workload calculations, answer-distribution and learning-mix donuts, colored topic bars, yearly activity with day details/year selection/keyboard navigation, weekly planned/completed estimates, and source-labeled evidence history. | Measured focus sessions, arbitrary date-range analytics, and production reporting. |

## Meaning of the local interactions
The personal learning pages now use one shared store and stable journey/item identifiers. Saved content creates actual local membership and allocation records. The schedule uses item durations and availability instead of repeating sample slot labels. Remaining scheduling policies are described in section 12 and must not be inferred from a sample cohort label.

Course and practice additions save references in the chosen journey. Adoption creates a distinct personal journey and preserves the source version. Adding published educator course content also grants that course's learner workspace atomically. Private institution sources stay inside their authorized course. Names are display labels, not record identity. Journey setup and personal learning records persist in SQLite; failed API writes retain the last confirmed client snapshot and display the error. An interrupted write with an unknown outcome blocks further writes until records are reloaded, rather than silently repeating the action.

Today, Calendar, and Progress read the same completion records. Evidence names the actual learning item and identifies manual or lesson completion. GitHub and LeetCode are not connected. No external authorization, synchronization, accepted-code result, or AI generation is claimed.

**Planning implication:** Preserve this shared record flow when expanding modules. The server is the persistence and permission boundary. A new page must connect to that boundary before it is described as a saved workflow.

<!-- page -->
# 05 | Current implementation: teaching and administration

## Educator and student institution views
Educators can switch between My Learning, personal Studio, and their available institutions. Course context carries a stable ID. Delivery includes course/lesson creation, educator-owned public publishing, class records, named discussion, assignments, text/link submissions, grading/release, official four-choice quizzes with revisioned attempts, and assessed completion records with unique serials and revocation history. Binary uploads and advanced content/assessment policies remain future work.

Students see coursework according to membership and course allocation. Course discussions use the posting account's named identity. Institution creation and administrator enrollment are functional local-server actions; they do not verify real-world institutional authority or email ownership. Opt-in fixture memberships are explicitly test data.

## Institution administration inventory
| Feature | Actual local-server behavior | Production gap |
| --- | --- | --- |
| Login | Persistent registration and server sessions; named institution-creator administrator membership. Three accounts exist only after test seeding. | Email/authority verification, recovery, and internet deployment. |
| User groups | Institution-scoped group creation and member allocation. | Full permission definitions, live role/deactivation lifecycle, protected-owner management, and bulk changes. |
| New enrollment | Administrator allocates an existing registered account as learner or educator to an institution course; educator capability is checked. Individual and CSV batch allocation use the same scope rules. | Invitations, email verification, account creation during intake, and removal/transfer policies. |
| Import/export | CSV quoting/newline parsing, required username/courseId/role and optional display-only columns, row preview/errors, atomic revalidation/commit, repeat-import skips, admin scope, and formula-safe export with durable audit. | XLSX files, arbitrary column mapping, update/remove operations, downloadable rejection reports, and richer intake policy. |
| Audit log | Administrative action, actor, scope, and timestamp records persist with the domain change; administrators receive scoped audit views. | Complete before/after coverage, reasons on every sensitive change, search, and retention policy. |
| Departments, programs, reports | Department/program creation and scoped academic records. | Full hierarchy lifecycle and defined report calculations/exports. |

## Local application boundary
The README describes the Node.js/SQLite runtime, server identity and scope checks, and explicit test-data scripts. Records survive refresh and server restart independently of browser storage. Clearing browser site data removes the session/theme preference, not the account's stored learning. Binary uploads and remote services require separate implementations.

`npm test` is the application-check entry point; focused model/API/academic/server checks are separately runnable. The [validation report](validation_report.md) records executed checks separately from observed browser interactions. Server scope, response privacy, persistence, and cleanup checks supplement browser interaction checks; none establishes external integrations or every production rollout property.

**Opt-in test fixtures:** riya_learns, asha_teaches, and northstar_admin use demo123 only after explicit test seeding. They are not created on ordinary startup. Cleanup targets tagged fixtures rather than resetting real registered accounts.

<!-- page -->
# 06 | Recommended corrections before expansion

**1.1 status:** P0 shared records, exact destinations, honest sources, real quiz scoring, and saved additions now use the server. P1 scheduling and persisted drafts share the same model. The table remains the acceptance contract; integration behavior and all advanced academic/scheduling policies are not implied.

## Replace disconnected samples with shared records
| Priority | Correction | Observable result |
| --- | --- | --- |
| P0 | Store learning items, tasks, evidence, and attempts by journey and user. | A completion updates Today, Calendar, and Progress once and persists after reload. |
| P0 | Bind actions to an exact item ID. | Manual completion names the actual problem; lesson and resource links open their source item. |
| P0 | Stop claiming verification from static connection labels. | Show Demo connection or Not connected until a real account is authorized and synchronized. |
| P0 | Replace Start quiz -> fixed result with a real attempt state. | Starting opens questions; submitting scores actual answers; empty attempts cannot produce a fabricated score. |
| P0 | Make enrollment and adoption store content references. | Added courses/sheets appear in the selected plan; adopted journeys contain their versioned items. |
| P1 | Use one scheduler for plan and calendar. | Changing available hours produces one consistent schedule and does not move fixed cohort sessions. |
| P1 | Preserve new-journey drafts during discovery. | Selecting content does not discard the entered name, planning mode, or availability. |
| P1 | Keep summaries derived and source labels explicit. | In-progress modules are not styled complete merely because they have notes or partial evidence. |

## Clarify potentially misleading actions
Schedule quiz should open a scheduling form, then show the saved event in Calendar. It should not only navigate to a calendar grid. A Today quiz link should open that scheduled quiz, while Review retains an on-demand quiz builder.

GitHub evidence should mean a linked solution artifact was found, unless an independent judging result exists. A repository commit by itself does not establish that the solution passed all test cases. Manual completion counts for personal planning with a visible source label.

Add keyboard operation and visible focus for all interactive controls. Calendar items should be real buttons or links, and dialogs should support focus return, Escape, validation messages, and mobile scrolling.

Use entity types and IDs rather than course-name text to determine context. The legacy prototype used a Section-name check and duplicate Classes fixtures; the replacement uses explicit context IDs and scoped academic records. Quiz results are computed from actual responses, with a visible numerator and denominator, instead of the former inconsistent fixed score.

## Specification adjustments made here
This blueprint removes persona switching, separate affiliated educator personas, institution public-course publishing, and a fixed organization hierarchy from the current baseline. Legacy suggestions about approvals for every evidence sync are replaced by automatic, traceable completion for unambiguous mappings, with review only for ambiguous evidence.

**Acceptance:** No success message appears unless its promised record was actually saved. Simulated functionality stays explicitly labelled until its implementation gate is met.

<!-- page -->
# 07 | Account, identity, and affiliation

**Status:** Server registration/login, identity/profile editing, educator capability, unique usernames, institution creation, and course-scoped enrollment are implemented. Email ownership and institutional-authority verification, recovery, and broader identity lifecycle remain unimplemented. The fields and workflows below remain the target where they exceed the delivered screens.

## Screens and information
Account settings should include username, display name, primary email, avatar, timezone, student/educator capability, password and security, linked institution emails, visibility preferences, and account lifecycle actions. Public profile information is edited separately from private authentication and contact information.

Institution accounts get a unique public handle and profile. Named personal accounts administer that institution through grants; avoid a shared institutional password as the operational model. The opt-in administrator test login represents one named person's scoped grant and is not created on ordinary startup.

## Onboarding and membership flow
1. Create a personal account and reserve a globally unique username. Normalize comparison consistently, validate allowed characters, and handle a duplicate with alternatives.
2. Verify the primary email. Set display name and personal learning interests; educator capability is configured through settings, with any verification policy stated explicitly.
3. Add an institution email. Verify possession and match a recognized institution domain or approved invitation.
4. Create a verified membership shell. Show affiliation status and a pending-allocation screen if no course or staff permissions exist yet.
5. An authorized administrator allocates groups and scopes. The institution dashboard then exposes the granted actions.

## Recommended rules and exceptions
- Username uniqueness reduces collisions, but does not prove a famous institution's authenticity. Use verified institution badges, reporting, and an impersonation review process.
- A verified institution email proves control of that email at that time. It must not automatically grant educator, administrator, or department-wide access.
- Support multiple memberships without duplicating the person's profile. Store each affiliation's dates, status, verification source, and permitted scopes.
- On leaving an institution, preserve personal journeys and independent work. Re-evaluate access to private classes and records, and label historical affiliation with its end date.
- Changes to educator capability must explain their effect on published courses and teaching assignments; do not delete teaching history when the setting changes.

## Acceptance criteria
Two account types cannot reserve the same normalized handle. Switching workspaces preserves the person ID. A new verified member sees no private class until allocated. Ending one membership does not erase independent portfolio items or grant access through another institution.

<!-- page -->
# 08 | Public profile, bio, and personal portfolio

**Status:** Account settings saves a private bio and identity fields on the server. Public profile and Portfolio remain private preview surfaces backed by personal journey/evidence records; they do not publish a profile. Visibility controls, artifact curation, public hosting, and the portfolio workflow below remain planned.

## Profile structure
| Area | Student | Educator | Institution |
| --- | --- | --- | --- |
| Identity | Name, handle, photo, bio, interests | Same plus teaching expertise and credentials | Name, handle, logo, description, verified domains |
| Affiliations | Visible affiliations by choice/policy | Current and past verified affiliations | Verified educators and institution overview |
| Offerings | Published journeys and sheets | Courses, cohorts, journeys, sheets | Directory of affiliated educators and their offerings |
| Record | Selected projects, evidence, skills | Learning portfolio plus teaching portfolio | Institution-controlled public facts and outcomes |
| Reputation | Journey/sheet ratings | Educator and content ratings separately | No public-course publisher identity in this scope |

## Portfolio user journey
The owner opens Portfolio from the account menu, chooses an existing project, completion record, problem solution, course outcome, or publication, and reviews what will be exposed. Each item has a title, summary, skills, role/contribution, date, source link, evidence type, and visibility. The owner can feature, reorder, hide, or archive it and preview the public page.

Offer Private, Unlisted link, and Public visibility as a recommended model. New evidence is private by default. Publishing a journey does not expose the adopter's schedule, attempts, institutional grades, private notes, or repository contents.

## Evidence presentation
Use distinct labels such as GitHub-linked solution, Platform module completion, Manually marked complete, and Issued certificate. A badge states its source and verification level. A self-declared skill is not displayed as a verified qualification. Let owners write a reflection that explains what the artifact demonstrates.

## Educator continuity
An educator's bio, independent offerings, public feedback, and personally owned work remain attached to their account. An institution can confirm affiliation and permissions; it does not overwrite the person's bio or automatically claim ownership of existing independent material.

## Acceptance criteria
Public preview and logged-out view match the selected visibility. Removing a public artifact hides it without deleting the private completion record. Revoked or unavailable evidence shows its current verification status. Public pages never disclose institution email, private code, access tokens, or unreleased grades.

<!-- page -->
# 09 | Ratings, reviews, and reputation

**Status:** No operational ratings or review service is connected. Eligibility, moderation, and reputation behavior below are recommendations for later delivery, not claims about the local catalogue.

## Keep review subjects distinct
Educator reviews describe a learner's teaching experience. Course reviews describe a specific course or offering. Journey reviews describe a reusable plan and its suitability. Practice-sheet reviews describe problem selection, explanations, and ordering. Do not merge these into one unlabeled score.

Institution affiliation is shown as context, not as the author of an educator's course. An institution can have its own verified profile without acquiring an automatic course rating from all affiliated educators.

## Review flow
1. Open the relevant educator or content page and choose Rate and review.
2. Check eligibility from enrollment, participation, adoption, or actual use. Show why a user is eligible or what is missing.
3. Enter a score and written feedback with the content version or teaching offering recorded.
4. Preview and submit; show moderation state. Allow editing while retaining abuse/audit history.
5. Allow the reviewed educator or publisher to respond once, with the same reporting rules. Show aggregate rating and review count together.

## Recommended safeguards and presentation
- Prevent self-reviews and duplicate reviews for the same review subject and eligible relationship. Define whether updated versions allow a new review or update the existing one.
- Display verified participation separately from the opinion itself. A verified-participation badge does not validate every factual statement in a review.
- Allow reporting for impersonation, harassment, disclosure of private information, and spam. Preserve ordinary critical feedback.
- Do not silently transfer reviews to a substantially different course or an unrelated owner. Show the version or offering context when needed.
- Avoid ranking a one-review item as equivalent to a heavily reviewed item solely by star average. Expose count and offer transparent sorting choices.

## Privacy and pending decisions
Named private course discussions are already agreed. Whether public reviews display a full name or public display name should be finalized separately. Private grade data should never be attached to a public review to prove eligibility.

**Acceptance:** An eligible learner submits one review, its subject and version remain traceable, unauthorized users cannot alter it, and moderation changes do not silently rewrite the original author's words.

<!-- page -->
# 10 | Discover, enroll, and explore practice

**Status:** The catalogue combines the clearly attributed starter library with published courses, journeys, and sheets. Search, checkbox filters, content details, saved additions/enrollment references, and version-attributed adoption are implemented. Reviews and the full set of recommended discovery controls below remain future work.

Private institution courses stay in their authorized academic workspace and are excluded from the public discovery/adoption catalogue. Copying them into personal journeys is deferred until source-linked access can be re-evaluated safely after membership changes.

## Discover details and filters
Use a single results surface for courses and published journeys. Offer query, content type, educator or student contributor, institution, topic, level, language, format, rating, and relevant sorting. Institution matching should follow the educator's eligible affiliation; agree whether historical affiliations remain searchable and label them explicitly.

A result detail page shows outcomes, prerequisites, estimated effort, syllabus or plan outline, publisher profile, affiliations, reviews, and access conditions. Cohort offerings show fixed dates and enrollment limits. Private academic courses require institutional entitlement even if a public description exists.

## Course enrollment
1. Learner selects Enroll. Show Add to an active journey or Create a new journey.
2. Active selection enables the journey dropdown; new selection disables it and requires a name.
3. Validate access and prerequisites that are truly blocking. Save the enrollment and the selected journey reference as separate records.
4. Show an allocation preview: modules added, required hours, projected finish, and any fixed sessions.
5. Open the updated journey plan with the added content highlighted. Re-enrollment must not duplicate the same course accidentally.

## Practice discovery and use
Practice keeps searchable checkbox filters for company, institution, topic, and publisher, alongside level and query. A company-plus-topic combination intersects those filters. Company tags describe reported interview relevance; record source and date where available instead of presenting every tag as verified fact.

Opening a sheet should expose its exact problems, source links, topic, difficulty, estimated effort, and publisher. A learner may attempt a problem at any time without adopting an entire journey or course. Add to journey stores selected problems or the sheet version and schedules only the chosen work.

## Empty and exception states
No matching results should offer Clear filters. Unavailable courses preserve existing learning records while explaining access. If a course already belongs to the journey, offer Open existing item or Add remaining modules rather than an unqualified duplicate.

**Acceptance:** A saved addition appears in the intended journey, survives reload, and opens the right module or problem. An unrelated catalogue filter cannot hide the destination of a direct item link.

<!-- page -->
# 11 | Create journeys and import a plan

**Status:** Content-first and Time-first setup save named journeys and selected content on the server. Drafts persist across catalogue visits and refresh; the scheduler uses actual item durations. Initial availability is distributed across weekdays and can be edited per day after creation. Target-capacity shortfalls require an explicit extension. CSV import now validates personal lesson/problem/review rows, previews allocation and errors without saving, and atomically creates a journey with no fabricated completion. The fuller import wizard, XLSX files, and arbitrary mappings below remain future work.

## Entry and fields
Journey plan normally shows the selected planned journey. Create new journey opens setup; My journeys in the account menu handles the cross-journey list. Fields: journey name, goal, start date, planning mode, timezone, weekly availability, per-day hours, content selections, optional target duration, and optional quiz cadence.

| Mode | User input | System response |
| --- | --- | --- |
| Time-first | Number of weeks, available days/hours, then courses/journeys/sheets | Compare workload to capacity, show a feasible allocation or a shortfall requiring a choice. |
| Content-first | Selected content and available days/hours | Estimate required weeks and finish date; allow changes to duration and workload. |
| Import attachment | Excel/CSV plan plus scheduling preferences | Map columns, validate rows, preview content and fixed/flexible dates, then create a journey. |

## Recommended setup flow
Save a draft before opening Discover or Practice. A selection tray shows the draft journey name and chosen content, with an explicit Return to setup action. Published journeys may contribute a whole copied template or chosen sections if partial import is supported; state which operation occurred.

The generated preview includes workload by activity, fixed sessions, unscheduled items, open days, and finish estimate. These are planning measures, not progress charts. Require a deliberate Save plan after preview. Changing a name must not create a duplicate journey ID.

## Import contract
**Current subset:** `Import plan CSV` accepts required `type,title,topic,minutes,url` headers and optional `date,startTime,fixed`. Types are lesson, problem, and review; durations are whole minutes and supplied URLs must use HTTP(S). Fixed sessions need valid dates/times, may not overlap or cross midnight, and cannot precede today or the plan start. Availability conflicts produce visible warnings. Flexible work uses the normal allocator. The preview shows row errors, workload, session count, finish estimate, warnings, and unscheduled work without saving. Repeating the same trimmed title and normalized content for one owner reopens the original imported journey, even if a different start date is supplied; use another title for a deliberate copy. Imported content neither grants institutional access nor invents external completion evidence.

Recommended columns: item type, title, topic, source URL or internal content ID, estimated minutes, preferred date, time, timezone, fixed/flexible flag, sequence, and optional quiz settings. Provide a downloadable template and examples.

An import wizard previews recognized rows and errors before committing. Unsupported files, broken links, missing durations, duplicate rows, and ambiguous dates need repair. Unknown course titles remain unresolved references; the import must not enroll into arbitrary content by name. A retry should not create the same plan twice.

**Acceptance:** Each mode produces the same saved task model. Refresh preserves a draft. A 20-hour workload cannot be labelled feasible inside ten available hours without an explicit reduction or extension. Attachment selection alone is never reported as a completed import.

<!-- page -->
# 12 | Scheduling and the journey calendar

**Status:** One local duration-based allocator feeds Today, Journey plan, and Calendar. Schedule preview/save supports per-day fractional hours, preserves completed/fixed allocations, and reports conflicts or unscheduled work. Individual future flexible sessions can be rescheduled. The full missed-work policy, restore/undo UI, official cohort integration, and advanced completion policies below remain later work.

## Capacity model
Keep weekly capacity as a numeric input. Each selected day has its own hours input; deselected days have zero availability and disabled inputs. Show the sum and difference immediately. Recommend a Distribute remaining hours action rather than discovering a mismatch only on Save. Support fractional hours, with the exact minimum increment to be agreed.

Generate sessions from durations and dependencies. Store date, start/end time where configured, timezone, task ID, allocation minutes, and fixed/flexible status. A course module can span multiple sessions. A daily slice completes when its assigned portion completes; the whole module completes only after all required portions.

## Save configuration behavior
1. Validate capacity and fixed obligations.
2. Preview affected future flexible tasks, new end date, and any unallocated work.
3. Preserve completed history and fixed cohort times. Show a conflict when a fixed class sits outside preferred hours.
4. Save the new plan revision and refresh Today, Calendar, and Journey plan from it.
5. Offer a way to inspect the change; implement undo or restore of a prior plan revision where feasible.

## Calendar and status semantics
The calendar derives from saved allocations. Empty days remain visible. Searchable checkbox filters for topic, activity, and status grey non-matching days; a day with several items remains highlighted if any item matches, and matching items are identified inside it. No week dropdown is required.

Retain four agreed task states: Completed; Partially complete - ahead; Partially complete - delayed; Planned. Treat timing separately: an untouched overdue item can remain Planned with an Overdue label. Partial work before or on its due boundary belongs to the ahead/on-schedule category; refine that label before release to avoid calling all same-day work ahead.

## Missed work proposal
Default to preserving daily capacity and proposing a later finish when work is missed. Offer preserve-target-date with a capacity warning, or manual rescheduling. Never silently overload a day. Practice generated in Review does not reserve a calendar slot.

**Acceptance:** No overlapping flexible sessions; quiz allocation follows its required learning; plan and calendar agree; schedule edits do not rewrite the evidence timestamp of work already done.

<!-- page -->
# 13 | Today, resources, and completion

**Status:** Today derives its tasks, load, counts, resources, and recent evidence from the selected journey's saved records. Exact item dialogs support notes, manual problem completion, and lesson/session completion. Seeded evidence is test data. Grouped problem tasks, externally emitted completion, and a richer learning player remain further delivery.

## Page composition
Show the date, journey, planned load, completed/remaining items, and logged evidence. Use one task row per actionable item or grouped problem set. A row includes type, title, source, planned duration, status, direct navigation icon, and completion source. Keep the next scheduled quiz visible without suggesting all days need a quiz.

Today resources are the lesson, problem statement, sheet instructions, reference notes, and artifacts needed for that day's work. Solved evidence is the output record. Both link to the specific item; source material alone should not count as proof of completion.

## Item-level behavior
| Item | Open action | Completion trigger |
| --- | --- | --- |
| External problem | Open that NeetCode/problem URL in a new tab | Matched GitHub evidence event or learner's manual mark. |
| Course module/session | Resume that exact module or daily assigned portion | A valid completion event from the learning player. |
| Planned quiz | Open its schedule details or active attempt | Submitted attempt, subject to the quiz's defined completion rule. |
| Optional revision | Open linked notes/problem review | Explicit learner completion with its source labelled. |

## Automatic task update
When a course module finishes, update all corresponding assigned task slices for that module portion and update Today without a second mark-done action. For a task containing several problems, completion requires all assigned problems; solving one gives partial progress. Already-solved prerequisites should be recognized before scheduling duplicate work, with an explicit retry option for revision.

Manual completion belongs on a particular problem row. Offer an optional note and evidence link, record who marked it and when, and allow correction. Do not append an unrelated sample problem or increment summary counts without a task association.

## Empty and asynchronous states
An open day says No planned work and offers optional practice or plan review. Returning from an external problem does not itself mark it done. A sync-in-progress state remains visible until evidence arrives or the user marks completion manually.

**Acceptance:** One problem completion changes its row, the grouped task, and the summary consistently. Completing a module updates its daily task exactly once and preserves the source record for review.

<!-- page -->
# 14 | Connections and evidence provenance

**Status:** Connections explicitly shows GitHub and LeetCode as Not connected. A user can attach a manual evidence link to an exact item; it remains self-reported. No external integration, synchronization, or independent judging runs. The connection/mapping model below is a future integration contract.

## Intended connection model
LeetCode represents a linked practice identity where supported; NeetCode is a problem-navigation destination in the agreed flow. GitHub holds solution artifacts used as evidence. Do not assume all three offer interchangeable completion feeds. Validate supported authorization and data-access methods during integration discovery before committing to synchronization coverage.

Connections settings should show provider, linked account, approved repository scope, mapping rule, last successful sync, connection status, and disconnect action. Use minimal access. A private repository must not become publicly browsable merely because a completion appears in the portfolio.

## Evidence event and mapping
Store evidence ID, owner, canonical problem/module ID, journey/task references, source type, source URL or opaque reference, repository and commit/file reference where applicable, observed timestamp, completed timestamp, and verification status. Store only the data necessary to support the record and display rules.

Recommended mapping starts with a canonical problem ID and a declared repository path convention or explicit mapping file. A sync event matching one problem and a valid artifact can automatically mark the task complete. If the match is ambiguous, place it in an evidence review queue; do not guess from a filename alone.

## Verification vocabulary
- GitHub-linked: a matching solution artifact was observed. This is provenance, not a guaranteed accepted-code result.
- Judge-verified: an independently supported judging result confirms acceptance, if that source can be integrated reliably.
- Manually completed: the learner asserts completion. It counts toward personal planning while retaining its lower-verification source label.
- Module completed: the platform or an authorized course source emitted a module-completion record.

## Failure and correction journey
On authorization expiry, show Reconnect and the last successful sync; keep existing records. Retried events must not duplicate completions. Repository rename, force-push, artifact deletion, or revoked access can change evidence availability without silently erasing historic activity. Allow re-linking evidence and flag the current verification state.

**Acceptance:** Duplicate delivery yields one evidence event; only the owner-authorized source affects their tasks; private artifact content never leaks into a public card; disconnected integrations fall back to manual completion with clear labels.

<!-- page -->
# 15 | Quizzes: planned assessment and optional practice

**Status:** Personal practice uses a curated question bank with server-side scoring, saved attempts/responses, a time limit, skipped counts, and answer explanations after submission. In-progress client records omit answer keys. Scheduled practice is added explicitly to the saved calendar; on-demand Review practice does not allocate time. Empty attempts do not receive a fabricated score. Educator-authored course quizzes are separately implemented in course context: four choices per question, one attempt per revision, server scoring, retained revision outcomes, and post-submission review. Course quiz choices are saved on submission, with no draft autosave/timer. AI generation, background generation jobs, question reporting, and the fuller assessment rules below remain planned.

## Two entry paths
Planned quizzes are created through Journey plan with a date/time, duration, difficulty, topic policy, and optional cadence. They appear in Today and Calendar. Review > Quizzes lets the learner generate an on-demand MCQ practice quiz from covered topics without changing the plan or reserving a day.

The builder presents covered topics as checkboxes with a brief coverage summary. Require at least one eligible topic. Difficulty and time are user selections; question count should be explicit or derived transparently from those settings. The quiz must not silently add unrelated topics.

## State and user journey
Draft settings -> generation queued -> ready -> in progress -> submitted or expired -> results and review. Scheduled settings also have scheduled, generation-failed, and cancelled states. At the scheduled time, resolve the actual covered topics and generate the quiz. If coverage is insufficient, explain and offer rescheduling or a smaller quiz rather than fabricating eligibility.

During an attempt, show remaining time, question navigation, selected answers, marked-for-review items, and save state. Submission confirms unanswered questions; expiration follows the stated rule. Retry creates a new attempt and retains the previous one. A generated question set should not change halfway through an attempt.

## Result and learning connection
Score actual responses against a stored answer key. Show correct, incorrect, skipped, topic breakdown, time used, and explanations. Record the attempt in the selected journey's history and include it in the Progress quiz dropdown. Wrong-topic actions open matching practice or covered learning resources.

Use grounded source material, generation-version metadata, duplicate checks, answer consistency checks, and a Report question action. Personal AI practice is distinct from official institution assessment: published academic quizzes require educator-controlled validation and attempt rules.

## Acceptance criteria
Starting a quiz never reports a score. Zero answered questions cannot return a fixed success result. A reported score has a visible numerator and denominator. A new practice quiz does not add calendar work. Failure to generate does not mark a scheduled task completed or lose its configuration.

<!-- page -->
# 16 | Progress and performance insights

**Status:** Completion, topic coverage, selected quiz results, estimated completed workload, learning mix, and evidence history read the selected journey's saved records. Colorful donut segments represent actual quiz answer counts or completed allocated minutes; topic bars represent completed/total items. An annual contribution-style calendar, selectable year/day detail, and eight-week planned/completed comparison are implemented. Equal-weight item counting and estimated time are labeled. Measured focus time, arbitrary date ranges, milestones, and institution reporting below remain future work.

**Annual activity contract:** The grid renders all 365 or 366 days, including February 29, with month/weekday alignment and future days distinguished. Intensity uses 0, 1, 2–3, 4–5, and 6+ real saved learning events. Dates follow the account timezone. Active days count days with events; optional submitted quizzes count as events but add no invented workload. Scheduled quiz attempts and their evidence count once. Corrected/reopened completion records and fixture examples are excluded. Partial-session workload is credited once, including when the remaining item is completed in a later year. Planned allocations are converted to account-timezone dates; invalid daylight-saving times are reported rather than silently assigned. Day buttons use one tab stop and arrow keys, with textual day details and legends.

**Fixture distinction:** The annual grid and completed weekly activity exclude seeded examples. Other existing journey completion, topic, evidence, and learning-mix totals can include clearly labeled sample fixture completion. A seeded course's 35 completed minutes can therefore appear in the learning mix while the annual grid shows only a later real 25-minute practice completion. The graph does not claim GitHub synchronization or measured study time.

## Metrics and calculation contract
| Insight | Recommended definition | User action |
| --- | --- | --- |
| Journey completion | Completed required units / all included required units, with an explicit weighting policy | Inspect incomplete work in Journey plan. |
| Planned vs actual time | Planned allocation minutes and separately logged focus minutes in the same period | Adjust capacity; distinguish estimated from measured time. |
| Topic coverage | Covered lessons/problems relative to selected topic content | Open remaining topic content. |
| Quiz performance | Correct, incorrect, skipped counts for one selected attempt or a weighted aggregate | Review actual answers and retry weak topics. |
| Weak areas | Accuracy and repeated errors with attempt count and recency | Open relevant practice or revision. |
| Learning mix | Logged time by course, practice, quiz/review | Inspect how effort is distributed. |
| Consistency | Days with meaningful activity; rest days interpreted using the schedule | Inspect the dated activity record. |

## Presentation
Keep charts relevant to the active journey. The latest screenshot-directed layout places the yearly activity grid below summary metrics, followed by weekly workload/topic coverage and colorful learning-mix/quiz donuts. Retain the quiz dropdown, legends, and textual data summaries. Use neutral empty states instead of invented chart segments. Milestones and arbitrary date-range filtering remain recommendations.

Do not use a 0% score when no data exists. Show Not enough attempts rather than labeling a topic weak based on one observation. Give source labels for manual and externally linked completion. Portfolio visibility should not require publishing the entire dashboard.

## Completion versus proficiency
Finishing an assigned item and mastering its topic are different measurements. A failed quiz may still be a completed attempt; a required course passing threshold may remain unmet. Define completion rules at the relevant level and show those distinctions to the learner.

An educator sees only their course/class records, and institution reports cover authorized academic scope. Personal journeys and independent practice remain private unless the learner deliberately shares them.

**Acceptance:** A saved attempt appears in the dropdown; charts agree with its answer counts; dates use the user's configured timezone; the same completion is not counted twice across synchronized sources or duplicated plan references.

<!-- page -->
# 17 | Educator Studio: course authoring and publishing

**Status:** Educator Studio supports draft course creation, descriptions, lesson content/resource links, and public course publication. Published catalogue entries carry versions and learner additions retain their copied version. The full draft-update/release/archive lifecycle, lesson reordering, rights review, and advanced offering settings below remain further work.

## Course builder
Course fields: title, summary, outcomes, topic tags, level, language, prerequisites, estimated effort, educator owner, visibility, self-paced/cohort format, affiliation display, and publication status. Inside the course, organize modules and lessons with ordering, required/optional flags, resources, practice links, and assessments.

The educator can draft content, reorder modules, preview as a learner, validate required fields, and publish a version. Store immutable published versions or equivalent historical references so learners retain a meaningful record when material changes. Keep a change summary and show the impact before replacing required work for existing learners.

## Publishing journey
1. Educator opens Studio > Courses > Create course.
2. Adds the syllabus, learning resources, practice sheets, and completion requirements.
3. Chooses self-paced or a fixed cohort offering; course material and offering timetable are related but separate records.
4. Reviews the learner preview, rights to included resources, and public profile attribution.
5. Publishes. Discover indexes eligible public offerings under the educator, with the chosen verified affiliation shown as context.
6. Learners enroll; the educator sees the roster and course-specific activity.

## Ownership and affiliation proposal
Independent courses belong to the educator subject to their declared rights. Institution-assigned teaching may use institution-controlled academic resources or approved course versions. The institution can manage access and assignments without becoming the public-course publisher. Clarify ownership and reuse rights when content is contributed under an institutional arrangement.

## Lifecycle and edge cases
Draft -> published -> updated -> archived. Archiving stops new enrollment while preserving the agreed access for current learners. If an educator loses affiliation, update the badge and institution access; do not automatically remove an independently owned course. If a course is removed for rights or safety reasons, show a learner-facing explanation and preserve appropriate completion history.

**Acceptance:** Student-only accounts cannot publish courses. A learner preview matches released content. A draft update cannot unexpectedly change an active quiz key, erase completed modules, or falsely credit an institution as publisher.

<!-- page -->
# 18 | Teaching delivery, classes, and learners

**Status:** Scoped course pages support materials, named discussion, assignments, submissions, grading/release, learner lists, and scheduled class records with optional external links. These records persist on the server. Roster transfer/deactivation UI, class-capacity policy, invitations, and the full delivery rules below remain further work; Learnio does not host video meetings.

## Dashboard and context
Studio Dashboard should surface actual work: next class, open learner questions, submissions awaiting feedback, draft courses, and publication issues. Courses are reusable content; Classes are delivery cohorts with a roster and timetable. Learners provides scoped participation records. Certificates remains an outcome tool, not a substitute for a gradebook.

Inside a selected course or class, use familiar tabs for Overview, Study material, Discussion, Assignments, Quizzes, and Grades. Put advanced settings inside the course rather than adding an excessive number of global sidebar entries.

## Cohort setup and teaching journey
An authorized educator selects an existing course version, gives the class a name, start/end dates, timezone, capacity, meeting slots, enrollment policy, and completion rules. They invite learners or use an authorized institution roster. Students see fixed sessions in course Calendar; personal planning accommodates them rather than shifting educator-set times.

During delivery the educator publishes materials, opens assessments, responds to named discussions, grades work, and sends course announcements. The dashboard links directly into the affected class and item. A teaching assistant, if supported, receives explicit limited access rather than the educator's credentials.

## Learner records
Show enrollment status, required content completion, submissions, quiz attempts, released grades, feedback, and relevant activity dates. Avoid inferring mastery solely from video-viewing time or inactivity. A follow-up queue may identify missing work, but explanations and permissions must be visible.

Bulk actions require a preview of recipients and affected scope. Exports include only entitled learner data and record an audit event. Personal portfolios are only accessible according to their chosen visibility, not because the viewer teaches one course.

## Acceptance criteria
One educator can teach at two institutions and independently without mixing rosters. A fixed session remains fixed during learner plan regeneration. Transferring a class assignment changes staff access promptly while retaining the named author of prior content and feedback. Learners can see published feedback only after release.

<!-- page -->
# 19 | Institution onboarding and academic structure

**Status:** Named accounts can create an institution with a reserved unique handle and creator-admin membership. Authorized administrators create institutional courses, enroll existing accounts with learner/educator scope, and create departments/programs. Registration alone grants no institution access. Real-world authority/domain verification, invitations, advanced hierarchy, and ownership recovery remain planned.

## Institution establishment
A named administrator creates or claims an institution profile and unique handle. The service verifies authority and approved email domains through a defined process, then records an initial owner/admin grant. Additional administrators receive named invitations and scoped permissions. Define ownership recovery before onboarding real institutions.

Recommended core structure is Institution > Department > Program > Cohort/batch > Course offering/class, with optional campus and term where needed. Start with a clear minimal hierarchy rather than an arbitrary hierarchy builder. The existing Departments, Programs, Courses, and Classes pages remain the editing and navigation surfaces.

## Member entry journey
1. Learner or educator links their institution email from account settings, or accepts a scoped invitation.
2. After verification, the institution shell shows membership status and pending enrollment/allocation information.
3. A reviewer or administrator validates the request and assigns permitted user groups and academic scope.
4. Assigned courses appear in the context selector; educators gain My teaching and the appropriate dashboard actions.
5. Changes, transfers, suspensions, and removals update effective access and create an audit record.

## Academic records and offerings
Institutions maintain course catalog references, sections, terms, educator assignments, rosters, and delivery rules. A course listing in this workspace is an academic organization record, not permission to release a public course as an institution. Public discovery still credits the educator's offering and affiliation.

## Edge cases
Recognize an existing verified personal account during enrollment instead of duplicating it. An email outside allowed domains needs a controlled invitation/exception process. Graduation can end active membership while preserving allowed read access to past courses and official records. Transfers between departments or institutions should not overwrite history.

**Acceptance:** A member without an allocation sees pending status rather than private class data. All context choices are permission-filtered. Removing an educator assignment immediately removes grading access for that class, while leaving independent Studio access intact.

<!-- page -->
# 20 | User groups, role allocation, import, and audit

**Status:** Administrator-only course enrollment, group creation/member allocation, and scoped durable audit records are implemented. Teaching and learning access checks reject revoked/suspended memberships. CSV preview/import uses existing usernames, explicit course IDs, and student/educator roles; invalid or duplicate rows reject the entire commit, and already enrolled rows are skipped. Authorized CSV exports include current entitled allocations, neutralize formula-like values, and record an audit event before download. Groups currently organize existing members rather than define a configurable permission engine. Role removal/transfer UI, full before/after audit coverage, XLSX support, invitations, and broader intake policies remain planned.

## Authorization model
A user group binds named members to one or more role grants within an institution scope. Separate the group label from the permission definition; renaming Computer Science Educators should not change what its members can do. Recommended grant fields: member or group ID, role, institution, department/program/class scope, start/end date, grantor, and status.

Permissions should cover roster view, membership review, group allocation, content management, assignment creation, grading, release of grades, report export, and audit view. A person sees the union of valid grants only within their scopes; sensitive changes require the corresponding administrative permission on the server.

## Excel/CSV import flow
**Current subset:** New enrollment provides a CSV template, file/text input, preview with row errors, and atomic commit. Required headers are `username,courseId,role` in any order; optional display-only `displayName,courseTitle` allow an exported file to be imported again. Roles are `student` or `educator`. The browser caps uploaded files at 100 KB and the server caps batches at 1,000 rows within its request-size limit. Imports cannot create accounts, grant administrator access, remove members, or silently resolve a course by title. The fuller workflow below remains a recommendation.

Download template -> upload -> map columns -> validate -> preview create/update/remove operations -> commit -> result and rejected-row report. Suggested columns include institution email, username/ID if known, group, role, scope type/ID, membership status, and effective dates.

Validate duplicate identities, unknown groups, invalid scopes, unverified addresses, forbidden privilege changes, date ranges, and conflicting rows. Never interpret a missing row as a deletion by default. Removal is an explicit operation with impact preview. Record the import job ID and make retries idempotent.

## Live editing and deletion
Show who gains or loses which actions before applying a change. Prevent removal of the last viable institution owner. A group with active members needs reassignment or an explicit deactivation path; retain historical references instead of destroying audit evidence.

## Export and audit
Exports match the active scope and selected fields, with a generated time and authorized actor. Neutralize spreadsheet formula-like cell values in exported user text. Audit records include actor, action, target, scope, before/after values, reason, timestamp, and correlation/import job ID. Audit viewers must not be able to rewrite the original event through the same UI.

**Acceptance:** A staff member cannot promote themselves through an import. Editing access changes allowed actions across the institution immediately. Replaying an import creates no duplicates. Every successful administrative change has a durable, searchable audit record.

<!-- page -->
# 21 | Institution student course experience

**Status:** Course-context navigation, protected materials, named discussion, assignments, text/link submissions, official revisioned quizzes, released grades, and assessed completion records use persisted records and server scope checks. Public educator-course adopters receive a separate learner course workspace. Private institution coursework remains within its scoped institution context. The full past-course lifecycle, resource availability policy, and official-to-personal completion link below remain further work.

## Active and past courses
After verified membership and allocation, students see their active enrolled courses and permitted past courses. Selecting a course inserts its section above Institution: Overview, Study material, Discussion, Assignments, Quizzes, Grades. Labels and actions retain the institution and class context.

| Course page | Primary content | Main user action |
| --- | --- | --- |
| Overview | Educator, syllabus, announcements, fixed sessions, next due work | Resume learning or open the next requirement. |
| Study material | Module/lesson tree, published resources, prerequisites, completion state | Open module, take private notes, finish assigned portion. |
| Discussion | Named course-specific questions, replies, pinned notices | Ask, reply, search, report, or follow a thread. |
| Assignments | Open/submitted/returned work, deadline, instructions, rubric | Submit, replace allowed submission, read feedback. |
| Quizzes | Scheduled official assessments, attempt limits, released reviews | Start eligible attempt or inspect allowed results. |
| Grades | Released grades, weighting, feedback, pending/ungraded states | Inspect calculation or request permitted review. |

## Personal planning connection
Offer Add course work to my journey as an explicit link. Preserve institutional due dates and fixed sessions. Personal study allocations can move around them; the personal planner must not change the official deadline or submit work on the learner's behalf.

An official module completion can update the linked personal task for the same module/version. Institution staff see the official completion record, not the rest of the learner's private journeys, independent practice, notes, or portfolio drafts.

## Past course behavior
Show why a course is read-only and which resources remain accessible. Preserve released outcomes according to policy. Do not allow new assignment submissions or discussions unless the course explicitly supports an extension or reopened activity. Broken or withdrawn resources need a meaningful explanation.

**Acceptance:** A student can follow Overview -> module -> completion -> linked Today update. A second student outside the class cannot access the module or discussion by copying its URL. Past-course visibility and official record access are consistent after graduation.

<!-- page -->
# 22 | Assignments, grading, and certificates

**Status:** Educators create assignments with instructions, due date, and maximum points. Learners submit text and optional evidence links; replacing ungraded work preserves the earlier version. Assigned educators save draft grades or release them. Released-grade changes require a reason and preserve grade history; learner responses omit unreleased grade details. Official course quiz outcomes and course assessment completion records are persisted and permission-scoped. Binary uploads, rubrics/weighting, late-policy enforcement, configurable attempt policies, and public certificate verification remain further work.

## Assignment lifecycle
Educator drafts title, instructions, linked learning outcomes, resources, allowed submission types, opening/due dates, timezone, rubric, points, late policy, and resubmission rules. Preview and publish to an assigned class. Learners upload or link work, review the submission summary, and receive a timestamped receipt and version number.

Record Draft -> Open -> Submitted -> Under review -> Graded -> Released. A resubmission creates a new version without erasing prior feedback. Missing, late, excused, and ungraded are distinct states. If a deadline is changed, keep the history and notify affected learners according to their course context.

## Grading and release
Authorized staff evaluate a chosen submission version using the rubric and written feedback. Draft grades remain staff-only until release. Grade changes after release require a reason and preserve before/after values in the audit log. A learner can request a recheck through a defined process rather than editing a grade directly.

The gradebook shows component weighting, earned/possible points, released status, and the effect of missing or excused work. An AI-generated practice quiz score is not automatically an official academic grade. Any AI grading assistance needs educator review and an explicit policy before adoption.

## Certificates and completion records
**Current policy:** An authorized course educator can issue a uniquely numbered assessment completion record only for an active enrolled learner, after at least one assessment exists and every current assignment has a released score of at least 60% and every current quiz revision has at least 60%. It does not require lesson completion or attendance. The record stores course version, issuer, learner, issue time, and the qualifying assessment snapshot. Duplicate active issuance for the same learner/course version is rejected. Authorized users can view/print records; the teacher can revoke with a reason, retained in history. This is a local course assessment record without external accreditation or a public verification endpoint. Existing records retain their issuance snapshot when a later assessment or grade changes; revocation is explicit.

An educator-issued course completion certificate can require modules, assessment thresholds, assignments, or attendance when relevant. Show unmet requirements before issuing. Store issuer, learner, course/offering version, issue date, unique ID, and a verification view with current status.

An institution can authorize institutional credentials under a separately defined issuing policy; that does not make it a public-course publisher. A revoked credential retains its ID with revocation status and reason visibility appropriate to policy. Offer portfolio inclusion as an explicit learner action.

## Acceptance criteria
The submitted file version remains retrievable after regrading. Unauthorized staff cannot view or change marks. Draft marks never appear in the student view. Grade totals reproduce the shown weighting. Certificates are issued once per defined achievement and cannot be displayed as valid after revocation.

<!-- page -->
# 23 | Resources, discussion, and notifications

**Status:** Personal resources open their exact item/source and notes save to the server. Course members can post named discussion messages within authorized course scope; administrators can publish institution announcements. Binary file storage, moderation/search/following, and notifications remain planned. The Notifications surface says no delivery service is connected.

## Resources in context
Use a shared resource record for uploaded files, internal lessons, external URLs, notes, and reference material. Record title, owner, type, linked course/module/problem, version, visibility, and availability. Today shows only resources needed for its tasks; course Study material organizes the full syllabus.

Keep personal notes private unless shared deliberately. Institution resources can provide rubrics and templates to authorized educators. A file replacement should preserve links or show version changes, and an unavailable external link should support reporting or substitution.

## Named course discussions
Threads belong to one course/class. Show the verified institution identity to eligible classmates and staff; do not expose the underlying email address merely to achieve named participation. Allow topic/title, text, permitted attachments, replies, search, pinning, resolved markers, and reporting.

An educator moderates within assigned scope. Removal records a reason and appropriate tombstone; it must not silently change the academic record. Institution administrators can investigate within defined permissions. Public course discussion, if introduced, requires an explicit identity and moderation policy rather than inheriting anonymous community behavior.

## Notification journey
An event such as released feedback, a class announcement, a changed deadline, a generated quiz, or a failed evidence sync creates a notification with source context. Opening it takes the user to the exact permitted item and marks it read. Email or push delivery is an optional channel controlled by preferences; essential in-app records remain discoverable.

Recommended controls: per-channel preferences, quiet hours, grouped reminders, digest options, and duplicate suppression. A reminder must not be sent twice because an event was retried. Avoid default direct messaging between every learner and educator until communication scope is agreed.

## Acceptance criteria
Copying a resource URL does not bypass its permissions. Discussion search stays inside the course. Notifications open the correct workspace and handle expired access gracefully. Resource views do not count as solved evidence unless an explicit learning completion rule is satisfied.

<!-- page -->
# 24 | Publishing journeys and standalone sheets

**Status:** Learners and educators can publish journeys and standalone practice sheets to the server catalogue, with Educator or Student contributor attribution. Journey publication excludes personal schedule/evidence/notes and rejects private institution/draft-course references. Adoption makes a separate personal journey with source version. Update offers, richer publication preview, moderation, review eligibility, and the rights policies below remain further work.

## Authoring and preview
A student or educator selects Publish journey from their plan. The public draft contains the title, summary, intended audience, prerequisites, learning outcomes, topics, estimated workload, referenced public content, and recommended sequence. Personal dates become relative week/day suggestions; private evidence, notes, grades, and repository data are excluded.

Before publishing, validate that linked material can be shared. A private institution lesson cannot become public through a journey template. Offer a placeholder explanation or a public alternative where a private reference cannot be exported.

Standalone practice sheets use the same attribution and publication principles. Authors organize problem references, topic and company tags, difficulty, estimated effort, ordering, and any original explanations. They can publish the sheet without publishing an entire course or journey.

## Adoption model
Adopt creates a new personal journey with the published title, as already agreed. Use a separate internal journey ID so an existing journey with the same display name is not silently reused. Store publisher attribution and source version. The adopter then configures availability and receives a personal schedule while keeping the original sequence and references traceable.

## Recommended version policy
Publish v1; subsequent edits create v2 with a change summary. Existing adopters remain on their adopted version until they review an update. The update preview identifies added, removed, reordered, and inaccessible content. Preserve completed work and allow the learner to accept selected changes or keep their plan.

Keep author credit on copied templates. A personalized adaptation can be republished with appropriate attribution and permission, subject to a policy still to be finalized. Do not copy another author's private material or reviews into a new publication.

## Acceptance criteria
Publication preview contains no private learning record. Adoption creates a distinct journey even if names repeat. The publisher cannot silently overwrite an adopter's schedule. Reviews remain tied to the published item/version relationship rather than the adopter's private progress.

<!-- page -->
# 25 | End-to-end student journeys

## Journey A: independent learning to a public portfolio
1. Riya signs in with her unique username, sets a bio and interests, and creates DSA Interview Prep in My Learning.
2. She chooses content-first, selects a course and a company/topic-filtered sheet, then assigns daily hours. The preview estimates duration and leaves unavailable days empty.
3. Today opens the precise NeetCode problem. She solves it and commits the solution to her mapped repository. A recognized GitHub artifact marks that problem complete with its source label.
4. A second problem has no mapped artifact, so she marks that exact item complete manually. Today distinguishes the two evidence sources and updates the grouped task.
5. She finishes the assigned course module. Its task automatically completes, and Calendar and Progress reflect the same event.
6. She takes a scheduled MCQ quiz, reviews incorrect answers, and opens a focused practice recommendation. An optional Review quiz adds an attempt without adding a calendar appointment.
7. She chooses two solution artifacts and a project for her portfolio, previews visibility, and publishes a reflection. Her private schedule and raw institutional records remain private.

## Journey B: joining a university without losing personal work
1. Riya links her institution email and verifies it. The institution shell shows Awaiting allocation.
2. An authorized administrator places her in a class group. The class appears under active courses.
3. She opens the course, reads Study material, asks a named course question, submits an assignment, and later reads released feedback.
4. She links an official module to her personal journey for planning. Course completion updates the linked task, but the institution cannot inspect unrelated personal activity.
5. On graduation, active membership ends. Permitted past-course records remain accessible; her personal handle, portfolio, and independent journeys continue.

## Journey C: creating a reusable learning path
Riya opens Publish journey, removes private references, writes outcomes and prerequisites, and previews a relative plan. Another student adopts it under the published title, configures their own availability, and later leaves an eligible review. Riya's future update is offered to the adopter, not imposed automatically.

**Success measure:** Each step has a saved record, an exact destination, a return path, and a visible explanation when access or evidence is unavailable.

<!-- page -->
# 26 | End-to-end educator and administrator journeys

## Journey D: one educator, independent and affiliated
1. Asha enables educator capability in account settings. Her My Learning workspace remains available for personal upskilling.
2. She fills her bio, expertise, portfolio, and teaching profile, then creates a course in Studio with modules, a sheet, and completion rules.
3. She previews and publishes the educator-owned course. Discover shows the course, profile, rating context, and any eligible verified affiliation.
4. She links an institution email. Verification creates membership; a staff allocation grants teaching access to the assigned class.
5. Inside institution My teaching, she publishes permitted resources, responds to course discussions, grades submissions, and releases feedback.
6. Learners review the relevant teaching experience or course. Her independent record remains attached to her profile if the affiliation later ends.

## Journey E: a university intake with controlled access
1. Maya opens New enrollment or imports the intake template. The preview separates new members, existing members, updates, and rejected rows.
2. She corrects invalid institution emails and unknown scopes, then commits the validated batch. The system creates a job receipt and durable audit events.
3. She assigns class groups and teaching roles. Effective permissions determine sidebar actions and server access.
4. A department transfer previews removed and added scopes, then updates access without duplicating the person.
5. An erroneous role change can be corrected through a new logged change. The original audit event remains available.
6. Reports aggregate only the academic scope she can manage. Exported records include the relevant period and report definition.

## Journey F: a complete assessment loop
Asha publishes an assignment with rubric and due time. Riya submits and receives a receipt. Asha grades the submitted version, reviews the draft score, and releases it. Riya sees the released result and feedback; course completion evaluates the defined rules. If eligible, an authorized issuer produces a certificate that Riya can choose to feature publicly.

## Cross-workspace invariants
The educator's personal quiz attempt is not a class grade. Institution membership is not public-course ownership. Administrator access does not expose private personal portfolios by default. One username follows the person; role grants, source ownership, and record visibility follow each context.

**Acceptance:** Replaying these journeys with a second institution cannot cross-link rosters, grades, private resources, or administrative permissions accidentally.

<!-- page -->
# 27 | Shared records and system boundaries

**Recommended architecture direction:** Start with a coherent application backend and shared database boundaries; choose technologies after workload and hosting decisions. The UI should consume the same records across pages rather than maintain separate page fixtures.

| Record group | Core records | Why it matters |
| --- | --- | --- |
| Identity | Account, profile, handle reservation, institution, membership, affiliation | Keeps one identity with multiple scoped relationships. |
| Authorization | Group, membership allocation, role, permission, scoped grant | Makes access enforceable beyond sidebar visibility. |
| Content | Course/version, offering, module, lesson, sheet/version, problem reference, resource | Separates authorship, reusable content, and delivery. |
| Planning | Journey, adopted source version, included items, availability, plan revision, task allocation | Gives Today and Calendar a common schedule. |
| Learning | Completion event, evidence, focus session, quiz definition, attempt, response | Produces reliable performance and portfolio records. |
| Academic delivery | Class roster, assignment/version, submission/version, rubric, grade/release, certificate | Preserves official workflow history. |
| Community and operations | Publication, review, discussion, notification, import job, audit event | Supports attribution, communication, and traceability. |

## Event flow
User action or authorized source event -> validate identity and scope -> save the domain change -> append a deduplicated event -> update affected task state and analytics -> send permitted notifications. Failures must be observable and retryable. The same completion event should not be counted once by GitHub sync and again as a new manual solve without reconciliation.

## Privacy and recovery
Authorize each read/write on the server using the record owner and institution/course scope. Store integration secrets separately from public data. Protect uploads by access scope, size/type checks, and a defined content-inspection pipeline. Keep security and audit events useful without logging credentials or private solution text unnecessarily.

Provide backups with a restore test, durable job states, data export, account closure handling, and a documented retention policy before production. Legal and institutional retention requirements need validation during deployment planning; this document does not prescribe a jurisdiction-specific retention period.

**Acceptance:** A record's ID and scope can be traced from UI action to saved outcome. Refresh, background retry, and concurrent changes do not create duplicate completion or unauthorized access.

<!-- page -->
# 28 | Delivery roadmap and release gates

Phases are recommended dependency order. Estimate dates only after the team, technology choices, integration feasibility, and university pilot scope are agreed.

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0: coherent prototype | Correct labels, exact item navigation, single journey sample model, honest integration states, accessible controls | UI walkthroughs no longer claim data was saved or verified when it was not. |
| 1: personal learning foundation | Real account/session, unique handles, per-journey storage, course/sheet references, task completion, manual evidence, editable bio | Create -> plan -> complete -> reload -> review works for two isolated accounts. |
| 2: connected learning | Real scheduling, Calendar/Today consistency, external evidence pilot, MCQ attempts and Progress calculations | Schedule edits preserve history; attempts score actual answers; sync retries are idempotent. |
| 3: educator delivery | Educator capability, course builder/versioning, enrollment, cohorts, materials, discussions, assessments, learner records | An educator delivers one complete course to a pilot group with controlled access. |
| 4: institution operations | Verification, membership allocation, hierarchy, groups, import/export, audit, institutional course tools and reports | One university runs intake, class assignment, submissions, grading and reporting with scope checks. |
| 5: public identity and reuse | Portfolio publishing, journey/sheet publishing, adoption versions, eligible reviews, moderation, certificates | Public pages expose only approved data; author and adopter updates behave predictably. |
| 6: scale and extended offerings | Reliability, search ranking, deeper reporting, interoperability, optional commercial features | Measured usage and support needs justify each extension. Organization design is discussed separately. |

## Dependency and rollout choices
Basic private bio/profile editing can ship in Phase 1; public reputation and portfolio publication wait for reliable provenance and visibility controls. Institution shells may be prototyped earlier, but production rollout waits for authorization and audit foundations. Integration work begins with a feasibility spike before promising external sync coverage.

Run a bounded pilot with sample courses and consenting participants. Define data cleanup and support ownership. Measure whether users can finish their main learning/teaching task, not only whether they visit a dashboard.

**Initial success signals:** plan creation completion, successful resume-to-learning rate, evidence mapping accuracy, task-state consistency, submission success, feedback turnaround, and access-control incident count. Set numerical targets after observing the pilot baseline.

<!-- page -->
# 29 | Backlog priorities and implementation packages

## First implementation package: make My Learning consistent
- ML-01: Journey entity and selected-content records; acceptance is durable add/enroll/adopt behavior without cross-journey leakage.
- ML-02: Schedule allocations and revisions; acceptance is a consistent plan/calendar with open days and preserved fixed sessions.
- ML-03: Exact task destinations and evidence events; acceptance is automatic module completion plus problem-specific manual completion.
- ML-04: Quiz lifecycle and attempt history; acceptance is actual answers producing results and Progress data.
- ML-05: Derived metrics and evidence history; acceptance is a traceable denominator and no fabricated empty-state scores.

## Teaching and university package
- TE-01: Course authoring, learner preview, and versioned release.
- TE-02: Cohort/class setup, assigned roster, materials, and course-specific discussion.
- TE-03: Assignment submission versions, rubric grading, grade release, and correction history.
- IN-01: Institution verification, membership shell, scoped group allocation, and access evaluation.
- IN-02: Validated intake/import jobs, member export, safe live role changes, and durable audit.
- IN-03: Past-course access, academic reports, and authorized certificate issuing.

## Identity and public contribution package
- ID-01: Account-menu profile, connections, My journeys, preferences, and capability management.
- PF-01: Private portfolio editor, visibility preview, public artifact cards, and source labels.
- PB-01: Journey and sheet drafts, publication validation, versioned adoption, and attribution.
- RP-01: Review eligibility, counts, reporting, response workflow, and moderation history.

## Definition of done for every package
A reviewed screen flow, saved schema, server authorization, validation and error states, keyboard/mobile behavior, relevant automated checks, and a tested user journey are required. Record whether the feature handles offline/retry, deletion/archival, and concurrent updates. Update the implementation inventory after each completed package rather than leaving completed work mixed with proposals.

## Avoid premature expansion
Payments, earnings, live-video hosting, a broad social feed, organization hierarchies, fully configurable institutional workflows, and automated high-stakes grading are future discussions. They should not delay the core learning-to-evidence or teaching-to-feedback loops.

**Planning ownership:** Product owns rules and acceptance; design owns screen and accessibility behavior; engineering owns data consistency and integration feasibility; an institutional representative validates academic delivery policies before rollout.

<!-- page -->
# 30 | Acceptance scenarios and quality checks

Use these as behavior checks, not just screenshot or label checks. Each requires an observable stored outcome.

| ID | Scenario | Required outcome |
| --- | --- | --- |
| A01 | Student and institution request the same handle | One succeeds; the other receives a clear uniqueness error. |
| A02 | Educator enters My Learning then institution | Identity stays fixed; context permissions and content change. |
| A03 | Enroll with new-journey choice | Active selector disabled; named journey and course reference saved. |
| A04 | Adopt a journey whose title already exists | New internal journey created with source attribution; no accidental reuse. |
| A05 | Change Monday from two hours to one | Future flexible allocations recalculate; completed/fixed items remain intact. |
| A06 | Filter calendar by topic plus activity | Matching items/days highlighted; others grey; open days remain visible. |
| A07 | Receive the same GitHub event twice | One mapped evidence record and one completion update. |
| A08 | Manually complete one of two assigned problems | Exact problem completes; parent task becomes partial until both are done. |
| A09 | Complete today's module | Today, Calendar, and Progress use the same completion event. |
| A10 | Start then submit a quiz with skipped answers | Actual answers scored; skipped denominator visible; attempt stored. |
| A11 | Generate practice quiz from Review | No calendar allocation created; results still enter attempt history. |
| A12 | Verify institution email without assignment | Pending membership shell only; no privileged class actions. |
| A13 | Try opening another class's private resource | Access denied at the server even with a known URL. |
| A14 | Import malformed and duplicate role rows | Preview rejects/errors rows; no unauthorized grants or duplicate commit. |
| A15 | Change released grade | Reason and before/after audit retained; learner sees updated released result. |
| A16 | Publish a portfolio/journey containing private work | Preview excludes restricted fields and blocks prohibited resources. |

## UX and resilience checks
Verify keyboard-only navigation, labelled icon actions, screen-reader status changes, readable chart summaries, narrow layouts, dialog focus return, slow requests, duplicate submission, and recovery after refresh. Check every feature with a second account and a second institution scope.

**Prototype caveat:** Source-label and click-path checks do not prove stored outcomes. Add behavior checks for each implementation package.

<!-- page -->
# 31 | Decisions to finalize

## Remaining product choices
| Decision | Recommended starting point | Needed before |
| --- | --- | --- |
| Username changes and impersonation | Stable handles; controlled rename history; verified institution status | Public account launch |
| Availability increments and fixed-class capacity | Fractional hours; fixed class conflicts explicit | Real scheduler |
| Late/partial status labels | Separate completion state from timing; preserve four agreed filters | Calendar release |
| Course completion weighting | Explicit required units and thresholds, shown per course/journey | Progress calculations |
| External evidence mapping | Canonical problem ID plus declared repo convention; ambiguity review | GitHub integration |
| Review eligibility and identity display | Participation-based eligibility; public display-name policy | Ratings launch |
| Affiliation search and historical badges | Clearly dated affiliations; policy for public filtering | Discover production |
| Institution content ownership and past access | Rights captured on contribution; explicit alumni policy | University pilot |
| Publication/adoption update rights | Versioned templates; adopter reviews updates | Journey publishing |
| AI quiz failure and official assessment rules | Retry/explain generation failure; educator validation for academic tests | Quiz production |
| Retention, exports, and account closure | Institution-aware policy validated for deployment context | Production data |
| Organizations and commercial offerings | Separate later discovery; no frozen structure yet | Extended scope |

## How to freeze a decision
Review the relevant screen and one complete user journey, then record the accepted behavior and its consequences for data, permissions, and existing users. Keep recommendations open until reviewed; do not infer agreement simply because a proposed field appears in this blueprint.

For the next My Learning discussion, prioritize scheduling conflict behavior, completion weighting, evidence mapping, and the exact lesson/problem detail screens. For the university pilot, prioritize institution ownership, academic access, assignment rules, and grade release. Organization structure remains a separate final discussion.

<!-- page -->
# 32 | Sources and maintaining this baseline

## References and traceability
**Primary product authority:** the design conversation through 30 September 2026, especially the later corrections about identity, affiliation, sidebar scope, filters, evidence, and completion.

**Implementation sources:** `app.js` and `academy-ui.js` (responsive learning, account, and academic interfaces); `learning-store.js` (shared personal domain and yearly activity rules); `api-store.js` (server snapshot client and serialized requests); `learning-charts.js` and `charts.css` (pure chart calculations and presentation); `server.js` (HTTP, sessions, SQLite, answer keys, scope projection); `academy.js` (teaching, institution, publication, and permission rules); `scripts/test-data.mjs` (targeted fixture lifecycle); `styles.css` and `index.html` (themes and entry); README and behavior checks (runtime, limitations, verification).

**Legacy planning source:** PRODUCT_FEATURES.md contains earlier ideas that conflict with the settled direction. Treat this versioned blueprint as the current planning baseline where those conflict. It does not imply every recommended addition has been approved or built.

## Change-control recommendation
For each future discussion, record the decision, date, affected user journeys, screen changes, data/permission effects, and acceptance checks. Mark a feature Implemented on local server, Local interaction, UI sample, Planned, or Production-ready based on evidence. Preserve version history so requirements and the delivered application can be compared honestly.

The common learning record now runs behind authenticated server APIs and SQLite persistence. The first academic workflow shares that boundary. Next priorities are deployment/recovery, verified institution onboarding, the remaining academic lifecycle rules, and the external integration contracts. Portfolio, reputation, and extended reporting should build on these records without overstating their provenance.

## Updating the document with the implementation
| Material | Purpose | Update trigger |
| --- | --- | --- |
| This blueprint and its Markdown source | Agreed rules, proposals, status, journeys, and acceptance gates | A product decision changes or a package is delivered. |
| Frontend, domain, API, server, and academic files | Actual behavior, authorization, and saved record model | A new interaction or data connection is implemented. |
| README.md and docs/demo_walkthrough.md | Runtime, test-data setup/cleanup, walkthrough, and operational limits | Runtime, persistence, account, or dependency changes. |
| check-demo.mjs and focused behavior checks | Runnable checks for implemented behavior | A nontrivial rule or workflow changes. |
| PRODUCT_FEATURES.md | Historical context, with a supersession notice | Keep as reference; avoid treating stale details as new requirements. |

## Documentation quality rule
Keep evidence-based implementation status separate from ambition. A connection badge is not proof of OAuth or synchronization; a CSV download is not an Excel import pipeline; a fixed result is not scoring; and a chart is not an analytics calculation. Record the actual demonstrated capability before moving a module into a delivered phase.
