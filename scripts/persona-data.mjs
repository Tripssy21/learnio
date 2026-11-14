import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fixtures, TEST_DATA_TAG } from './test-data.mjs';
const require = createRequire(import.meta.url);
const { openDatabase, readState, writeState, QUESTIONS } = require('../server.js');
const { createStore } = require('../learning-store.js');
const academy = require('../academy.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = new Set(['riya', 'asha', 'maya']);
const check = result => { if (!result.ok) throw Error(result.error); return result; };
const date = offset => new Date(Date.now() + offset * 86400000).toISOString();
const classStart = (offset, slot) => {
  const start = new Date(date(offset)), [hour, minute] = [[3, 30], [5, 0], [7, 30], [9, 0], [10, 30]][slot % 5];
  start.setUTCHours(hour, minute, 0, 0); // Institute teaching slots: 09:00–17:00 in Asia/Kolkata.
  return start.toISOString();
};

// Keep identity, credentials, and the minimal institutional membership required for role access.
export function clearPersonaDetails(state) {
  for (const id of ids) {
    const user = state.users.find(u => u.id === id);
    if (user && user.testDataTag !== TEST_DATA_TAG) throw Error(`Refusing to reset non-test account ${id}.`);
  }
  const rows = Object.values(state.academy || {}).filter(Array.isArray).flat();
  const owned = r => r.testDataTag === TEST_DATA_TAG || [r.ownerId, r.userId, r.authorId, r.issuerId].some(id => ids.has(id));
  const removed = new Set(rows.filter(owned).map(r => r.id));
  for (const r of rows) if (!owned(r) && ([r.courseId, r.assignmentId, r.quizId, r.submissionId, r.parentId, r.semesterId, r.departmentId, r.programId, r.targetId, r.announcementId, r.eventId].some(id => removed.has(id)) || r.institutionId === 'northstar')) throw Error(`Non-test record ${r.id} depends on persona data; no changes made.`);
  for (const [id, data] of Object.entries(state.userData)) if (!ids.has(id) && ((data.memberships || []).some(m => m.institutionId === 'northstar' || m.courseIds?.some(c => removed.has(c)) || [m.semesterId, m.departmentId, m.programId, ...(m.announcementReadIds || [])].some(ref => removed.has(ref))) || (data.journeys || []).some(j => j.contentReferences?.some(r => removed.has(r.id))))) throw Error(`Account ${id} depends on persona data; no changes made.`);
  for (const [key, records] of Object.entries(state.academy || {})) if (Array.isArray(records)) state.academy[key] = records.filter(r => !owned(r)).map(r => {
    for (const field of ['learnerIds', 'teacherIds', 'memberIds']) if (Array.isArray(r[field])) r[field] = r[field].filter(id => !ids.has(id));
    return r;
  });
  for (const id of ids) if (state.userData[id]) {
    const memberships = state.userData[id].memberships.filter(m => m.institutionId === 'northstar').map(m => Object.fromEntries([...['id', 'institutionId', 'institutionName', 'username', 'role', 'status', 'scope', 'verified', 'source', 'testDataTag'].filter(key => key in m).map(key => [key, m[key]]), ['courseIds', []]]));
    state.userData[id] = { selectedJourneyId: null, journeys: [], evidence: [], attempts: [], draft: null, enrollments: [], memberships, testDataTag: TEST_DATA_TAG };
  }
  return removed.size;
}

export async function intensiveFixtures() {
  let state = await fixtures();
  const act = (user, action, input) => check(academy.action(state, user, action, [input]));
  // Generate history through the same learning operations used by the application.
  for (const user of state.users) {
    user.bio = `${user.displayName}: synthetic QA persona for learning, collaboration, and assessment workflows.`;
    let clock = new Date(date(-84));
    state.activeUserId = user.id;
    const store = createStore({ questions: QUESTIONS, now: () => clock, storage: { getItem: () => JSON.stringify(state), setItem: (_k, value) => { state = JSON.parse(value); } } });
    check(store.importPlan({ title: 'Engineering practice · 12-week lab', goal: 'Build, explain, test, and review practical engineering solutions.', fingerprint: createHash('sha256').update(user.id).digest('hex'), startDate: date(-84).slice(0, 10), items: Array.from({ length: 96 }, (_, i) => ({ type: i % 3 === 0 ? 'problem' : i % 3 === 1 ? 'lesson' : 'review', title: `Lab ${i + 1}: ${['Arrays', 'Python basics', 'Functions'][i % 3]}`, topic: ['Arrays', 'Python basics', 'Functions'][i % 3], minutes: 20 + (i % 5) * 10, url: 'https://docs.python.org/3/tutorial/' })) }));
    const j = store.getJourneys().find(j => j.title.startsWith('Engineering practice'));
    for (let i = 0; i < j.items.length; i++) {
      check(store.saveNote(j.id, j.items[i].id, `Lab ${i + 1}: compare two approaches, test boundary inputs, and document time and space complexity.`));
      if (i < 72) {
        clock = new Date(date(-84 + i));
        check(store.completeItem(j.id, j.items[i].id, { note: `Synthetic QA completion ${i + 1}; verified local examples and edge cases.`, url: 'https://docs.python.org/3/tutorial/' }));
      }
    }
    clock = new Date();
    check(store.saveSchedule(j.id, j.availability));
    const python = store.getJourneys().find(entry => entry.title === 'Python Foundations');
    check(store.addContent('python-course', python.id));
    for (let n = 0; n < 6; n++) {
      const topic = QUESTIONS[n % QUESTIONS.length].topic;
      if (!store.getCoveredTopics(j.id).includes(topic)) continue;
      const attempt = check(store.startQuiz({ journeyId: j.id, topics: [topic], difficulty: QUESTIONS[n % QUESTIONS.length].difficulty, minutes: 15 }));
      const a = store.getAttempt(attempt.attemptId);
      for (const [i, q] of a.questions.entries()) check(store.answerQuiz(a.id, q.id, n % 2 && i % 2 ? (q.answer + 1) % q.options.length : q.answer));
      check(store.submitQuiz(a.id));
    }
    check(store.selectJourney(j.id));
    check(store.saveDraft({ title: 'Next quarter: systems practice', goal: 'Design reliable services with measurable outcomes.', planningMode: 'content-first', startDate: date(1).slice(0, 10), availability: j.availability, contentIds: ['python-journey'] }));
    act(user.id, 'publishJourney', { journeyId: j.id });
    for (const journey of state.userData[user.id].journeys) for (const item of journey.items) {
      item.note ||= 'QA study note: trace one example, test boundary inputs, and explain the result.';
      item.sourceUrl ||= 'https://docs.python.org/3/tutorial/';
      item.description ||= `Practice and review ${item.title}.`;
      item.content ||= 'Work through a small example, implement the solution, and document complexity and boundary tests.';
    }
    for (const evidence of state.userData[user.id].evidence) evidence.url ||= 'https://docs.python.org/3/tutorial/';
  }
  state.activeUserId = null;
  state.academy.courses[0].materials[0].sourceUrl = 'https://docs.python.org/3/tutorial/datastructures.html';
  act('maya', 'createProgram', { institutionId: 'northstar', title: 'Applied Software Engineering', description: 'Twelve-week program with weekly labs, reviewed assignments, and mastery checks.' });
  act('maya', 'createDepartment', { institutionId: 'northstar', title: 'Data and AI', description: 'Data analysis, practical modeling, and responsible evaluation.' });
  const subjects = [
    ['Python Engineering', 'Develop reliable Python applications using modular design, collections, file handling, exceptions, and automated tests. Weekly programming studios connect language fundamentals to maintainable software.'],
    ['Database Design', 'Model relational data, normalize schemas, and implement SQL queries, transactions, and indexes. Design a database for a campus service and evaluate its correctness and query performance.'],
    ['Web Systems', 'Build accessible web applications with HTTP, browser interfaces, server APIs, and persistent data. Evaluate authentication, security, and deployment through a team application project.'],
    ['Algorithms Lab', 'Implement and compare searching, sorting, graph, and dynamic programming algorithms. Laboratory sessions emphasize correctness proofs, complexity analysis, and experimental performance measurement.'],
    ['Software Testing', 'Design unit, integration, and system tests from requirements and risks. Practice boundary analysis, test doubles, regression testing, and defect reporting while evaluating coverage and release readiness.'],
    ['Capstone Studio', 'Deliver a faculty-mentored engineering project from proposal to demonstration. Teams conduct requirements research, review architecture, test their implementation, and present evidence of technical and user outcomes.']
  ];
  for (const [title, description] of subjects) {
    const courseId = act('maya', 'createCourse', { institutionId: 'northstar', title, description }).courseId;
    act('maya', 'enroll', { courseId, username: 'asha_teaches', role: 'educator' });
    act('maya', 'enroll', { courseId, username: 'riya_learns', role: 'student' });
  }
  const module = (topic, title, description, content, sourceUrl, prompt, options, explanation) => {
    const offset = topic.length % options.length;
    return { topic, title, description, content, sourceUrl, quiz: { prompt, options: options.slice(offset).concat(options.slice(0, offset)), answer: (options.length - offset) % options.length, explanation } };
  };
  const curricula = [
    [
      module('Arrays', 'Indexed collections and boundary-safe lookup', 'Choose array operations by access pattern and explain their time and memory costs.', 'Implement linear lookup and indexed access for a student marks list. Test empty input, the first and last positions, and a missing value. Record which operations depend on the number of elements.', 'https://docs.python.org/3/tutorial/datastructures.html', 'Which operation on an array typically uses constant time?', ['Accessing an element by a valid index', 'Searching every element for a missing value', 'Inserting at the first position and shifting the rest', 'Sorting an arbitrary array'], 'A valid index identifies the element directly; searching, shifting, and sorting require additional work.'),
      module('Linked lists', 'Nodes, links, and insertion invariants', 'Trace linked-list operations and preserve the head and next-pointer invariants.', 'Draw a three-node list and implement insertion at its head. Test insertion into an empty list. Explain why locating an arbitrary position still requires traversal.', 'https://cs50.harvard.edu/x/2025/notes/5/#linked-lists', 'After inserting a new node at a singly linked list head, where should its next link point?', ['To the previous head', 'To itself', 'Always to the tail', 'To an unrelated node'], 'The new node links to the previous head so the existing list remains reachable.'),
      module('Hashing', 'Hash-based lookup and collision handling', 'Use hashing for repeated key lookups and distinguish expected from worst-case cost.', 'Build a word-frequency map from a short document. Compare it with repeated list scans, test duplicate words, and explain how a collision strategy preserves all keys.', 'https://docs.python.org/3/library/stdtypes.html#mapping-types-dict', 'What is a hash collision?', ['Different keys mapping to the same bucket or hash value', 'Two arrays having the same length', 'A key being read without being modified', 'Every key receiving a unique bucket'], 'A collision occurs when different keys share a hash destination and must be distinguished.'),
      module('Trees', 'Ordered trees and traversal', 'Apply the binary-search-tree ordering rule and choose an appropriate traversal.', 'Insert three distinct keys into a binary search tree and draw the links. Trace an in-order traversal, then compare the height of balanced and skewed examples.', 'https://cs50.harvard.edu/x/2025/notes/5/#trees', 'Which traversal returns a binary search tree with distinct keys in sorted order?', ['In-order traversal', 'Pre-order traversal in every case', 'Level-order traversal in every case', 'Random traversal'], 'In-order traversal visits the left subtree, node, and right subtree under the tree ordering rule.')
    ],
    [
      module('Python basics', 'Expressions, control flow, and input contracts', 'Write readable Python control flow and handle invalid input explicitly.', 'Create a grade-band calculator from a numeric score. Validate the accepted range, use clear conditions, and test boundary values rather than relying on truthiness alone.', 'https://docs.python.org/3/tutorial/controlflow.html', 'Which control-flow construct repeats work over every value in a Python iterable?', ['A for loop', 'A single return statement', 'An import statement alone', 'A variable annotation'], 'A for loop iterates over values supplied by an iterable.'),
      module('Collections', 'Lists, dictionaries, and practical transformations', 'Select a collection that fits ordered data, membership, or key-based lookup.', 'Transform a list of student records into a dictionary keyed by roll number. Detect duplicate identifiers and compare lookup with a linear scan over the original records.', 'https://docs.python.org/3/tutorial/datastructures.html', 'Which Python collection naturally stores a roll number mapped to a student record?', ['A dictionary', 'A plain integer', 'A single boolean', 'A raw file descriptor'], 'A dictionary represents key-value associations and supports lookup by key.'),
      module('Functions', 'Function contracts and reusable modules', 'Define explicit parameters, return values, and predictable function behavior.', 'Extract a marks-summary function with a documented empty-input rule. Return the computed result instead of printing it. Test the function independently before importing it into a reporting module.', 'https://docs.python.org/3/tutorial/modules.html', 'What makes a marks-summary function easier to reuse and test?', ['Returning its result through an explicit contract', 'Reading unrelated global state on every call', 'Printing the only result and returning nothing', 'Combining file deletion with the calculation'], 'Explicit inputs and returned results let callers use and test the calculation without unrelated side effects.'),
      module('Python testing', 'Automated checks and exception paths', 'Verify normal, boundary, and error behavior using a Python test suite.', 'Write unit tests for the marks-summary function. Include an empty collection, one record, a typical collection, and an invalid value. Check both the returned result and the expected exception.', 'https://docs.python.org/3/library/unittest.html', 'Which unittest assertion checks that an operation raises an expected exception?', ['assertRaises', 'assertIsNone for every exception', 'assertEqual on a printed message', 'assertTrue without invoking the operation'], 'assertRaises verifies that the operation raises the specified exception type.')
    ],
    [
      module('Relational model', 'Entities, keys, and referential integrity', 'Model students, courses, and enrollments with primary and foreign keys.', 'Design separate Student, Course, and Enrollment tables. Identify each primary key and the two enrollment foreign keys. Explain how the model prevents an enrollment referring to a missing student.', 'https://www.postgresql.org/docs/current/tutorial-concepts.html', 'What is the purpose of an enrollment table foreign key to Student?', ['To require the referenced student record to exist', 'To automatically sort all enrollments by date', 'To make every student take every course', 'To replace all primary keys with text descriptions'], 'A foreign-key constraint maintains a valid reference to a student record.'),
      module('SQL joins', 'Joining enrollment and course records', 'Choose inner and outer joins according to whether unmatched rows must remain.', 'Write a query joining students to their enrolled courses. Then use a left join to include students with no enrollment. Compare row counts and explain the null values on unmatched rows.', 'https://www.postgresql.org/docs/current/tutorial-join.html', 'Which join preserves every student while showing matching enrollment rows when available?', ['Student LEFT JOIN Enrollment', 'Student INNER JOIN Enrollment in every case', 'A WHERE condition that removes all unmatched students', 'Joining only students who already have enrollment rows'], 'A left join preserves rows from the left table even when the right table has no match.'),
      module('Normalization', 'Dependencies and update anomalies', 'Separate facts by their dependencies to reduce duplicated and inconsistent data.', 'Analyze a table repeating department names on each student enrollment. Identify the relevant dependencies, separate department facts, and show how a single department-name update now changes one record.', 'https://cs50.harvard.edu/sql/notes/2/', 'Why store a department name once in a department table rather than repeat it in every enrollment?', ['To reduce inconsistent updates to the same department fact', 'To remove the need for any joins forever', 'To guarantee every query becomes faster', 'To permit conflicting department names for one department ID'], 'Separating a shared fact avoids duplicated values becoming inconsistent during updates.'),
      module('Transactions', 'Atomic enrollment changes and rollback', 'Group related changes into a transaction and recover safely from failures.', 'Model a seat allocation and enrollment insert as one transaction. Simulate failure after the first update and verify rollback restores the earlier state. Explain the difference between committing a unit of work and leaving it partially applied.', 'https://www.postgresql.org/docs/current/tutorial-transactions.html', 'What should happen when one operation fails inside an atomic enrollment transaction?', ['Roll back the transaction so partial changes are not retained', 'Commit whichever partial changes happened first', 'Ignore the failure and decrement every course seat count', 'Delete all unrelated student records'], 'An atomic transaction commits the whole unit of work or rolls it back.')
    ],
    [
      module('HTTP', 'Requests, responses, and status codes', 'Explain HTTP methods, request data, and response status semantics.', 'Inspect a course-list request in browser developer tools. Identify its method, URL, status, and response content. Compare a successful response with a missing-resource response and document the difference.', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview', 'Which HTTP status normally indicates that a requested resource was not found?', ['404', '200', '201', '204'], '404 indicates that the requested resource was not found.'),
      module('API integration', 'Fetching data and handling failures', 'Connect a browser interface to an API with loading, success, and error states.', 'Build a course-list interface using fetch. Check response.ok before parsing data, show a useful error when the request fails, and ensure the loading state ends on both success and failure.', 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch', 'Why check response.ok when using fetch?', ['HTTP error responses can still resolve the fetch promise', 'It encrypts the response body automatically', 'It grants administrator access to the caller', 'It converts every response into a database transaction'], 'fetch can resolve for HTTP errors; response.ok identifies successful status codes.'),
      module('Accessible interfaces', 'Semantic forms and keyboard interaction', 'Create interfaces that provide labels, focus behavior, and semantic controls.', 'Build an enrollment form with visible labels and a native submit button. Navigate it using a keyboard, associate validation errors with the affected fields, and test that focus remains visible.', 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility', 'Which choice best provides an accessible action control?', ['A native button with an understandable label', 'A styled span with no keyboard behavior', 'A clickable image with no text alternative', 'A mouse-only div whose purpose is hidden'], 'A labeled native button supplies standard keyboard behavior and control semantics.'),
      module('Authentication', 'Sessions and authorization boundaries', 'Distinguish identifying a user from deciding which records they may access.', 'Trace login, a protected API request, and logout. Enforce course access on the server, test a student request for another course, and verify a closed session no longer authorizes requests.', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication', 'Where must access to private course records be enforced?', ['On the server for each protected request', 'Only by hiding a browser navigation link', 'Only in a downloaded screenshot', 'By trusting any course ID sent by the client'], 'Client presentation can be changed; the server must authorize protected record access.')
    ],
    [
      module('Searching', 'Linear and binary search experiments', 'Choose a search strategy from the input ordering and required operations.', 'Implement linear search and binary search over a sorted marks list. Count comparisons for present and missing targets, then explain why binary search needs an ordered search space.', 'https://docs.python.org/3/library/bisect.html', 'What input property is required for the usual binary-search algorithm?', ['The search range is sorted by the comparison order', 'Every value is identical', 'The collection contains exactly two elements', 'All values are stored in a hash table'], 'Binary search discards half of an ordered range based on comparison with its midpoint.'),
      module('Sorting', 'Ordering, stability, and measured cost', 'Compare sorting methods and recognize when preserving equal-key order matters.', 'Sort student records by score after an earlier name ordering. Inspect the order of equal-score records, compare stable and unstable strategies, and record run times for increasing input sizes.', 'https://docs.python.org/3/howto/sorting.html', 'What does a stable sort preserve?', ['The original relative order of records with equal keys', 'The original position of every record regardless of its key', 'The size of the processor cache', 'Every record in an unsorted sequence'], 'Stability preserves the relative order of records that compare equal on the sort key.'),
      module('Graph traversal', 'Breadth-first exploration and visited sets', 'Represent connections as a graph and prevent repeated visits during traversal.', 'Model campus buildings and walkways as an unweighted graph. Implement breadth-first search from the library, record the visited set, and reconstruct a route with the fewest edges.', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/', 'Which traversal finds a path with the fewest edges in an unweighted graph?', ['Breadth-first search', 'A random walk with no visited set', 'Depth-first search in every case', 'Sorting vertex names alphabetically'], 'Breadth-first search explores vertices in increasing edge distance from the source.'),
      module('Complexity analysis', 'Growth rates and performance evidence', 'Relate operation counts to asymptotic growth and experimental measurements.', 'Compare a single scan with a nested pairwise comparison. Count operations for several input sizes, draw the growth trend, and explain what the measurement supports and what machine-dependent timing cannot prove.', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/lecture-notes/', 'For a linear-time scan, how does doubling a large input size typically affect the number of operations?', ['Approximately doubles the operation count', 'Makes the operation count stay exactly constant', 'Always squares the operation count', 'Makes the operation count fall to zero'], 'A linear-time operation count grows in proportion to input size.')
    ],
    [
      module('Unit testing', 'Isolating behavior with focused tests', 'Test a small unit through its observable contract and control its dependencies.', 'Write focused tests for an invoice-total function. Replace the external price service with a test double, check rounding behavior, and keep the tests independent of network availability.', 'https://docs.python.org/3/library/unittest.mock.html', 'What is a useful reason to replace an external service with a test double in a unit test?', ['To control inputs and avoid dependence on a live network service', 'To guarantee the real service never needs integration testing', 'To remove every assertion from the test', 'To force all tests to share production credentials'], 'A test double provides predictable behavior while the unit is tested independently.'),
      module('Integration testing', 'Testing cooperating components', 'Verify contracts across real component boundaries while protecting test data.', 'Exercise an enrollment API with a temporary database. Verify the saved enrollment through a second request, reject an invalid course reference, and clean up the temporary records after the check.', 'https://docs.pytest.org/en/stable/how-to/fixtures.html', 'What distinguishes an integration test of an enrollment API and database?', ['It verifies cooperating components across their actual boundary', 'It checks only an isolated arithmetic expression', 'It contains no assertions', 'It is always performed against a live production database'], 'An integration test verifies that components work together through their shared interfaces.'),
      module('Test design', 'Equivalence classes and boundary cases', 'Choose representative valid, invalid, and boundary inputs from a requirement.', 'For a score accepted from 0 through 100, design cases just below, at, and above the limits. Add representative interior values and explain the expected result for every case.', 'https://docs.pytest.org/en/stable/how-to/parametrize.html', 'Which input set directly exercises both boundaries of an accepted score range from 0 through 100?', ['-1, 0, 1, 99, 100, 101', 'Only 50 repeated six times', 'Only 20 and 80', 'Only valid scores from 10 through 90'], 'Values on and immediately outside the limits reveal boundary acceptance and rejection behavior.'),
      module('Continuous integration', 'Repeatable checks before merging changes', 'Run automated checks in a repeatable environment and interpret failures.', 'Configure a workflow that installs the project requirements and runs its tests on proposed changes. Introduce one failing assertion, inspect the report, fix the defect, and confirm the workflow returns to a passing state.', 'https://docs.github.com/en/actions/tutorials/build-and-test-code/python', 'What is the main purpose of running tests in continuous integration for a proposed change?', ['To provide repeatable evidence that the change passes automated checks', 'To guarantee there can never be a production defect', 'To replace all code review and requirements work', 'To silently publish every failing change'], 'Continuous integration provides repeatable check results that inform review and release decisions.')
    ],
    [
      module('Requirements', 'Problem definition and acceptance criteria', 'Connect stakeholder needs to observable acceptance criteria and project scope.', 'Interview a campus-service stakeholder and identify the problem being addressed. Write a short scope statement, prioritize three user needs, and define how each need will be verified in the final demonstration.', 'https://docs.github.com/en/issues/planning-and-tracking-with-projects', 'Which acceptance criterion is easiest to verify?', ['A student can view only courses in their recorded enrollment', 'The application should be very impressive', 'The interface should feel completely perfect', 'Every possible future feature should exist'], 'An observable enrollment rule can be exercised and checked against a specific expected result.'),
      module('Architecture', 'Component responsibilities and design tradeoffs', 'Assign clear component responsibilities and document a justified design choice.', 'Sketch the browser, API, and persistence boundary for your project. Describe which component validates enrollment permissions and compare two storage designs against the actual project constraints.', 'https://learn.microsoft.com/en-us/azure/architecture/guide/', 'What should a useful architecture decision record explain?', ['The decision, relevant context, alternatives, and consequences', 'Only a screenshot of the final dashboard', 'Only the names of every team member', 'A promise that no design tradeoffs exist'], 'A decision record connects a chosen design to its context, considered alternatives, and consequences.'),
      module('Implementation', 'Incremental delivery and reproducible builds', 'Deliver a working slice and document how another person can run it.', 'Implement one complete user flow through the interface, API, and database. Commit the working slice, document setup steps and configuration, and verify the steps in a fresh project checkout.', 'https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories', 'Which deliverable best supports a reproducible project handoff?', ['Documented setup steps that work in a fresh checkout', 'Undocumented local files on one developer laptop', 'A screenshot without source or setup instructions', 'A verbal assurance that the application once ran'], 'A verified setup procedure lets another person reproduce the working project.'),
      module('Project review', 'Evidence, feedback, and final demonstration', 'Present verified outcomes and respond to review feedback with traceable changes.', 'Demonstrate the agreed acceptance criteria and show the relevant test results. Record reviewer feedback, explain unresolved limitations, and identify the change that addresses each accepted review comment.', 'https://docs.github.com/en/pull-requests/reference/pull-request-reviews', 'What should accompany a capstone claim that a key workflow is complete?', ['Demonstration and verification evidence for its acceptance criteria', 'Only the number of lines written', 'Only a decorative project logo', 'An unsupported claim that all users will be satisfied'], 'Completion is supported by observable behavior and verification against the agreed criteria.')
    ],
    [
      module('Data preparation', 'Features, missing values, and leakage', 'Prepare model inputs without using evaluation data to fit preprocessing steps.', 'Split a small dataset into training and held-out evaluation sets. Fit missing-value handling on training data only, apply the same transformation to evaluation data, and document the selected input features.', 'https://scikit-learn.org/stable/modules/preprocessing.html', 'Why fit preprocessing parameters on the training set rather than on all available data?', ['To avoid using evaluation information during model preparation', 'To force every feature to become text', 'To eliminate the need for an evaluation set', 'To guarantee every model has perfect accuracy'], 'Preprocessing fitted using evaluation data can leak information into the training process.'),
      module('Supervised learning', 'Baselines for classification and regression', 'Choose a supervised task and compare a learned model with a simple baseline.', 'Define a prediction target, distinguish classification from regression, and train a small baseline model. Report the baseline result before experimenting with a more complex estimator.', 'https://scikit-learn.org/stable/supervised_learning.html', 'Which target is naturally a regression task?', ['Predicting a continuous house price', 'Classifying a message as spam or not spam', 'Classifying an image as cat or dog', 'Choosing a categorical course section label'], 'Regression predicts a continuous numerical target.'),
      module('Model selection', 'Validation and cross-validation', 'Use validation results to compare candidate models while protecting the final test set.', 'Compare two model configurations with cross-validation on the training data. Record the scoring rule and fold results, choose a configuration, and keep the held-out test set untouched until final evaluation.', 'https://scikit-learn.org/stable/modules/cross_validation.html', 'Which data should remain untouched while tuning a model for final evaluation?', ['The held-out test set', 'Each training fold used for fitting', 'The validation results used for comparison', 'The parameter grid being explored'], 'The final test set is reserved to estimate performance after model selection.'),
      module('Evaluation', 'Metrics, error analysis, and limitations', 'Choose evaluation metrics that reflect the prediction task and its error costs.', 'Report precision and recall for an imbalanced classification problem. Inspect false positives and false negatives, explain which error matters more in the chosen application, and describe the limits of the evaluation sample.', 'https://scikit-learn.org/stable/modules/model_evaluation.html', 'Which pair of metrics helps distinguish false-positive and false-negative behavior in classification?', ['Precision and recall', 'File size and line count', 'Screen width and height', 'Training filename and course code'], 'Precision and recall describe different aspects of classification errors and positive predictions.')
    ]
  ];
  for (const [n, c] of state.academy.courses.entries()) {
    for (const [k, lesson] of curricula[n].entries()) act('asha', 'addMaterial', { courseId: c.id, ...lesson, duration: 30 + k * 10 });
    for (let k = 0; k < 3; k++) {
      const lesson = curricula[n][k];
      act('asha', 'createAssignment', { courseId: c.id, title: `${c.title} · ${lesson.topic} studio`, description: `${lesson.content} Submit your implementation or analysis, verification evidence, and a short reflection explaining one tradeoff.`, maxPoints: 100, dueDate: date(k === 0 ? -7 : 7 + k * 7).slice(0, 10) });
    }
    for (const [k, a] of state.academy.assignments.filter(a => a.courseId === c.id).entries()) {
      if (n === 1 && k === 2) continue; // An unsubmitted assignment allows testing submission from the student UI.
      const lesson = curricula[n][n === 0 ? Math.max(0, k - 1) : k];
      act('riya', 'submitAssignment', { assignmentId: a.id, body: `${lesson.topic}: completed the worked example and documented expected versus actual results. Verified a typical case, a boundary case, and an invalid-input or failure scenario. The reflection explains the main design choice and its limitations.`, sourceUrl: lesson.sourceUrl });
      const s = state.academy.submissions.find(s => s.assignmentId === a.id);
      if (n === 2 && k === 1) continue;
      act('asha', 'grade', { submissionId: s.id, score: a.maxPoints * .8, feedback: 'Correct reasoning and useful tests. Expand the boundary-case explanation.', released: !(n === 3 && k === 1) });
      if (k === 0) act('asha', 'grade', { submissionId: s.id, score: a.maxPoints * .9, feedback: 'Rechecked the edge cases; updated credit for the complete analysis.', reason: 'QA grade correction example after rubric review.', released: true });
    }
    for (let k = 0; k < 2; k++) {
      const qid = act('asha', 'createCourseQuiz', { courseId: c.id, title: `${c.title} · Knowledge check ${k + 1}`, questions: (k === 0 ? curricula[n] : [...curricula[n]].reverse()).map(lesson => lesson.quiz) }).quizId;
      const q = state.academy.courseQuizzes.find(q => q.id === qid);
      if (n === 4 && k === 1) continue;
      act('riya', 'submitCourseQuiz', { quizId: q.id, revision: q.revision, answers: Object.fromEntries(q.questions.filter((_v, i) => !(n === 0 && k === 1 && i === 3)).map((v, i) => [v.id, n === 5 && i > 0 ? (v.answer + 1) % 4 : v.answer])) });
    }
    if (n === 0 || n === 6) {
      const certificateId = act('asha', 'issueCertificate', { courseId: c.id, userId: 'riya' }).certificateId;
      if (n === 6) act('asha', 'revokeCertificate', { certificateId, reason: 'Synthetic revocation scenario for testing record history.' });
    }
    for (let k = 0; k < 3; k++) {
      act('asha', 'createClass', { courseId: c.id, title: `${c.title} · ${['Review clinic', 'Live lab', 'Office hours'][k]}`, startAt: classStart(k === 0 ? -2 : k + 1 + n % 4, n), minutes: 60, joinUrl: 'https://example.test/learnio/classroom', location: `Academic block A · Room ${201 + n}`, classType: ['tutorial', 'lab', 'office-hours'][k] });
    }
    act('asha', 'post', { courseId: c.id, body: `For the ${curricula[n][0].topic} studio, which design choice did you make and what evidence supports it? Share one limitation to discuss with the class.` });
    const parentId = state.academy.posts.at(-1).id;
    act('riya', 'post', { courseId: c.id, parentId, body: `I worked through ${curricula[n][0].title.toLowerCase()} and recorded the expected and actual results. My reflection compares an alternative and identifies the conditions where my choice is suitable.` });
    act('asha', 'post', { courseId: c.id, parentId, body: 'Connect the comparison to the studio learning goal and include the evidence that verifies your conclusion.' });
  }
  for (let n = 0; n < 3; n++) {
    act('maya', 'createGroup', { institutionId: 'northstar', title: ['Capstone cohort', 'Algorithms study circle', 'Peer review team'][n] });
    const g = state.academy.groups.at(-1);
    for (const username of ['riya_learns', 'asha_teaches', 'northstar_admin']) act('maya', 'addGroupMember', { groupId: g.id, username });
    g.courseIds = state.academy.courses.slice(n, n + 2).map(c => c.id);
    act('maya', 'announce', { institutionId: 'northstar', title: ['Assessment schedule', 'Lab resources available', 'Capstone review week'][n], body: 'Synthetic test notice: review the course materials, attend the scheduled clinic, and submit evidence before the published due dates. Contact your educator in the course discussion for help.', category: ['examinations', 'academic', 'academic'][n], audience: 'all', priority: n === 0 ? 'important' : 'normal', office: 'Office of Academic Affairs', reference: `NST/QA/${new Date().getFullYear()}/00${n + 1}`, attachmentUrl: 'https://docs.python.org/3/tutorial/', expiresAt: date(35).slice(0, 10) });
  }
  // College records deliberately distinguish enrollment from the institute's full offering catalogue.
  const year = new Date().getFullYear(), academicYear = `${year}–${year + 1}`;
  const semester = (title, startDate, endDate, status, yearLabel = academicYear) => act('maya', 'createSemester', { institutionId: 'northstar', title, academicYear: yearLabel, startDate, endDate, status }).semesterId;
  const previousSemesterId = semester(`Spring ${year}`, `${year}-01-05`, `${year}-05-15`, 'completed', `${year - 1}–${year}`);
  const currentSemesterId = semester(`Monsoon ${year}`, `${year}-07-20`, `${year}-12-15`, 'current');
  const nextSemesterId = semester(`Spring ${year + 1}`, `${year + 1}-01-04`, `${year + 1}-05-14`, 'upcoming');
  const departmentId = 'computing', programId = state.academy.programs[0].id;
  state.academy.programs[0].title = 'B.Tech · Computer Science and Engineering';
  state.academy.programs[0].description = 'Four-year undergraduate program with semester core courses, electives, laboratories, and a capstone project.';
  const institutionCourses = state.academy.courses.filter(c => c.institutionId === 'northstar');
  const terms = [currentSemesterId, currentSemesterId, currentSemesterId, previousSemesterId, currentSemesterId, nextSemesterId, previousSemesterId];
  const codes = ['CS201', 'CS203', 'CS205', 'CS204', 'CS207L', 'CS302', 'CS299P'];
  for (const [n, c] of institutionCourses.entries()) {
    act('maya', 'updateCourse', { courseId: c.id, title: c.title, description: c.description, semesterId: terms[n], code: codes[n], credits: n === 4 ? 2 : n === 6 ? 6 : 4, kind: n === 4 || n === 6 ? 'lab' : n === 5 ? 'elective' : 'core', departmentId, programId });
    if (terms[n] !== currentSemesterId) {
      const termYear = terms[n] === previousSemesterId ? year : year + 1;
      state.academy.classes.filter(v => v.courseId === c.id).forEach((v, k) => { v.startAt = `${termYear}-03-${String(10 + k).padStart(2, '0')}T${v.startAt.slice(11)}`; });
      state.academy.assignments.filter(v => v.courseId === c.id).forEach((v, k) => { v.dueDate = `${termYear}-03-${String(17 + k).padStart(2, '0')}`; });
    }
  }
  for (const [userId, rollNumber, section, advisor] of [['riya', `${year - 2}CSE042`, 'CSE · Section A', 'Dr. Asha Rao'], ['asha', 'FAC-CSE-017', 'Computer Science faculty', 'Prof. Meera Sen · Head of Department'], ['maya', 'ADM-ACA-003', 'Academic administration', 'Registrar · Academic Affairs']]) {
    act('maya', 'updateAcademicProfile', { institutionId: 'northstar', userId, rollNumber, departmentId, programId, semesterId: currentSemesterId, admissionYear: year - 2, section, advisor });
    state.userData[userId].memberships.find(m => m.institutionId === 'northstar').institutionName = 'Northstar Institute of Technology';
  }
  const offeringId = act('maya', 'createCourse', { institutionId: 'northstar', title: 'Introduction to Machine Learning', description: 'Explore supervised learning, feature preparation, model selection, and responsible evaluation. Build baseline classifiers and regression models, compare their performance, and explain their limitations through guided laboratory experiments.', semesterId: currentSemesterId, code: 'CS310E', credits: 3, kind: 'elective', departmentId, programId }).courseId;
  act('maya', 'enroll', { courseId: offeringId, username: 'asha_teaches', role: 'educator' });
  for (const [k, lesson] of curricula[7].entries()) act('asha', 'addMaterial', { courseId: offeringId, ...lesson, duration: 35 + k * 10 });
  act('asha', 'createAssignment', { courseId: offeringId, title: 'Evaluation protocol', description: 'Choose a baseline, explain your data split, and compare evaluation metrics. Include reproducible results and discuss how class imbalance affects your conclusions.', maxPoints: 100, dueDate: date(21).slice(0, 10) });
  act('asha', 'createCourseQuiz', { courseId: offeringId, title: 'Machine Learning · Concepts and evaluation', questions: curricula[7].map(lesson => lesson.quiz) });
  act('asha', 'createClass', { courseId: offeringId, title: 'Machine Learning · Evaluation laboratory', startAt: classStart(3, 1), minutes: 90, joinUrl: 'https://example.test/learnio/classroom/evaluation', location: 'AI laboratory · Room 310', classType: 'lab' });
  const electiveNoticeId = act('asha', 'announce', { institutionId: 'northstar', title: 'Machine Learning elective: lab preparation', body: 'Synthetic institute notice. Bring the model evaluation worksheet and your baseline results to the laboratory. Review precision, recall, and validation data splits before the session.', category: 'academic', audience: 'course', targetId: offeringId, priority: 'normal', office: 'Computer Science teaching office', reference: `NST/QA/${year}/ML-01`, attachmentUrl: 'https://scikit-learn.org/stable/modules/model_evaluation.html', expiresAt: date(28).slice(0, 10) }).announcementId;
  // Preserve private records as an unallocated offering while removing the temporary content-author allocation.
  state.academy.courses.find(c => c.id === offeringId).teacherIds = [];
  state.userData.asha.memberships.find(m => m.institutionId === 'northstar').courseIds = state.userData.asha.memberships.find(m => m.institutionId === 'northstar').courseIds.filter(id => id !== offeringId);
  const day = offset => date(offset).slice(0, 10);
  const event = (userId, scope, type, title, offset, days, location, description) => act(userId, 'createCalendarEvent', { institutionId: 'northstar', scope, type, title, description: `Synthetic QA calendar entry. ${description}`, startDate: day(offset), endDate: day(offset + days), startTime: scope === 'personal' ? '14:30' : '09:00', location, semesterId: currentSemesterId });
  event('maya', 'campus', 'holiday', 'Institute holiday · Autumn break', 5, 1, 'Entire campus', 'Teaching sessions pause during the published institute holiday; rescheduled classes will be announced by the course educator.');
  const holidays = state.academy.calendarEvents.filter(e => e.scope === 'campus' && e.type === 'holiday');
  for (const session of state.academy.classes.filter(c => state.academy.courses.find(course => course.id === c.courseId)?.semesterId === currentSemesterId)) {
    const start = new Date(session.startAt);
    while (holidays.some(h => start.toISOString().slice(0, 10) >= h.startDate && start.toISOString().slice(0, 10) <= h.endDate)) start.setUTCDate(start.getUTCDate() + 1);
    session.startAt = start.toISOString();
  }
  event('maya', 'campus', 'exam', 'Mid-semester examination window', 12, 4, 'Academic blocks A and B', 'Check your enrolled-course examination instructions and bring your institute identity card.');
  event('maya', 'campus', 'registration', 'Next semester elective registration', 25, 6, 'Academic office · Student portal', 'Discuss electives with your faculty advisor and submit the registration form before the window closes.');
  event('maya', 'campus', 'event', 'Research and innovation open day', 8, 0, 'Central auditorium', 'Student teams present projects and discuss research opportunities with faculty mentors.');
  event('riya', 'personal', 'meeting', 'Faculty advisor meeting · Riya', 2, 0, 'CSE office · Room 204', 'Review current-semester workload, elective choices, and the capstone preparation checklist with Dr. Asha Rao.');
  event('asha', 'personal', 'meeting', 'Teaching preparation · Asha', 1, 0, 'Faculty office · Room 212', 'Prepare the rubric and demonstrations for the enrolled Data Structures section.');
  event('maya', 'personal', 'meeting', 'Academic operations review · Maya', 4, 0, 'Registrar conference room', 'Review the registration window, assessment room allocations, and upcoming campus notices.');
  const notice = (userId, category, audience, targetId, priority, title, body, office, reference, expiry = 30) => act(userId, 'announce', { institutionId: 'northstar', category, audience, targetId, priority, title, body: `Synthetic QA notice for Northstar Institute of Technology. ${body}`, office, reference: `NST/QA/${year}/${reference}`, attachmentUrl: 'https://docs.python.org/3/tutorial/', expiresAt: day(expiry) }).announcementId;
  const registrationNoticeId = notice('maya', 'academic', 'students', '', 'important', 'Monsoon semester: registration and course verification', 'Verify your current enrolled courses and academic profile. An institute offering is active for you only after an administrator records your enrollment. Contact the academic office for corrections.', 'Office of Academic Affairs', 'ACA-101');
  notice('maya', 'examinations', 'program', programId, 'urgent', 'Mid-semester assessment: timetable verification', 'Check the examination window in the campus calendar. Course-specific room, duration, and assessment instructions are supplied by your allocated course educator.', 'Examination Cell', 'EXM-204', 18);
  notice('maya', 'fees', 'students', '', 'important', 'Semester fee verification desk', 'Students can verify payment references and report discrepancies to the accounts office during the published help-desk window. This test notice does not request real payment.', 'Finance and Accounts Office', 'FIN-031', 14);
  notice('maya', 'scholarships', 'department', departmentId, 'normal', 'Department mentoring and scholarship documentation clinic', 'Bring the completed documentation checklist to the department clinic. Faculty advisors will explain eligibility and verification steps; this fixture does not represent a real scholarship offer.', 'Student Welfare Office', 'SCH-008', 21);
  notice('maya', 'placements', 'students', '', 'normal', 'Career preparation: resume review appointments', 'Book a review through your faculty advisor, prepare a project summary, and bring evidence of your work. This synthetic notice makes no employment promise.', 'Career Development Centre', 'CDC-041', 35);
  notice('maya', 'campus', 'all', '', 'normal', 'Research open day: campus participation', 'Use the campus calendar to find the event location and timing. Students and faculty are invited to discuss projects and research interests.', 'Dean of Student Affairs', 'CAMP-019', 20);
  const teacherNoticeId = notice('maya', 'academic', 'educators', '', 'important', 'Faculty: moderation and assessment release checklist', 'Verify grading rubrics, record correction reasons, and release only finalized grades. Student accounts must not receive this faculty-only notice.', 'Dean of Academic Affairs', 'FAC-014', 25);
  notice('asha', 'academic', 'course', 'cs-201', 'normal', 'Data Structures: review clinic preparation', 'Bring a tested lookup implementation and explain the complexity tradeoff in your course discussion before the next live clinic.', 'Computer Science teaching office', 'CS201-006', 15);
  const archivedNoticeId = notice('maya', 'academic', 'all', '', 'normal', 'Archived: previous semester grade verification', 'The previous semester verification window has closed. This notice remains available in the archive for reference.', 'Examination Cell', 'ARCH-002', -7);
  act('maya', 'archiveAnnouncement', { announcementId: archivedNoticeId });
  act('riya', 'markAnnouncementRead', { announcementId: registrationNoticeId });
  act('asha', 'markAnnouncementRead', { announcementId: teacherNoticeId });
  act('maya', 'markAnnouncementRead', { announcementId: electiveNoticeId });
  const publicId = act('asha', 'createCourse', { title: 'Public Python practice', description: 'A public course for testing discovery, adoption, and personal planning.' }).courseId;
  act('asha', 'addMaterial', { courseId: publicId, title: 'Functions in practice', topic: 'Functions', duration: 45, description: 'Write a reusable function and test its contract.', content: 'Use explicit parameters and return values. Test empty input and typical values. Record the result and explain your approach.', sourceUrl: 'https://docs.python.org/3/tutorial/controlflow.html' });
  act('asha', 'publishCourse', { courseId: publicId });
  act('asha', 'publishSheet', { title: 'Boundary-case workout', description: 'Practice complete input coverage with short exercises.', items: Array.from({ length: 8 }, (_, i) => ({ title: `Boundary exercise ${i + 1}`, topic: 'Arrays', duration: 20, description: 'Handle empty arrays, duplicate values, and boundary positions.', content: 'Implement a lookup and write three tests; explain the expected results.', sourceUrl: 'https://docs.python.org/3/tutorial/datastructures.html' })) });
  return state;
}

export async function runPersonaData(command, filename) {
  if (!['clean', 'seed'].includes(command)) throw Error('Use clean or seed.');
  const fixture = command === 'seed' ? await intensiveFixtures() : null;
  const db = openDatabase(filename);
  try {
    db.exec('BEGIN IMMEDIATE');
    const state = readState(db);
    const before = structuredClone(state);
    const recordsRemoved = clearPersonaDetails(state);
    if (fixture) {
      for (const user of fixture.users) {
        const existing = state.users.find(u => u.id === user.id);
        if (!existing && state.users.some(u => u.username === user.username || u.email === user.email)) throw Error('Persona username or email conflicts with another account.');
        if (!existing) state.users.push(user);
        else if (!existing.bio) existing.bio = user.bio;
        state.userData[user.id] = fixture.userData[user.id];
      }
      state.academy ||= {};
      for (const [key, records] of Object.entries(fixture.academy)) {
        state.academy[key] ||= [];
        if (records.some(r => state.academy[key].some(x => x.id === r.id))) throw Error(`Record conflict in ${key}.`);
        state.academy[key].push(...records);
      }
      for (const name of fixture.reservedUsernames) {
        if (state.users.some(u => u.username === name)) throw Error('Institution handle conflicts with an account.');
        if (!state.reservedUsernames.includes(name)) state.reservedUsernames.push(name);
      }
    }
    // A state export inside the write transaction captures a consistent pre-reset snapshot.
    const backup = `${filename}.persona-backup-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(before), { flag: 'wx', mode: 0o600 });
    for (const id of ids) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    state.revision++;
    writeState(db, state);
    db.exec('COMMIT');
    return { command, backup, accountsPreserved: state.users.filter(u => ids.has(u.id)).length, recordsRemoved, academy: Object.fromEntries(Object.entries(state.academy || {}).filter(([, r]) => Array.isArray(r)).map(([k, r]) => [k, r.length])) };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--db');
  const filename = index < 0 ? process.env.LEARNIO_DB || path.join(root, 'data', 'learnio.sqlite') : process.argv[index + 1];
  try { if (!filename) throw Error('--db requires a filename.'); console.log(JSON.stringify(await runPersonaData(process.argv[2], path.resolve(filename)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

