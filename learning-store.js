/* Shared Learnio domain model. The server owns persistence and authorization; browser usage is a read-only snapshot view. */
(function (root) {
  'use strict';
  const KEY = 'learnio.local.v1';
  const VERSION = 1;
  // OWASP PBKDF2-HMAC-SHA256 minimum; legacy hashes are upgraded after a successful sign-in.
  const PASSWORD_ITERATIONS = 600000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const minutes = time => { const [h, m] = String(time).split(':').map(Number); return h * 60 + m; };
  const time = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  const plusDays = (date, count) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10); };
  const dateAt = (stamp, timezone = 'Asia/Kolkata') => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(stamp);
  const DEFAULT_AVAILABILITY = { weeklyHours: 10, days: { 0: 1, 1: 1.5, 2: 1.5, 3: 1.5, 4: 1.5, 5: 1.5, 6: 1.5 }, startTime: '18:00', timezone: 'Asia/Kolkata' };
  const finishDate = tasks => tasks.filter(t => !t.cancelledAt && validDate(t.date)).reduce((last, t) => !last || t.date > last ? t.date : last, null);
  function planningTarget(journey, settings = {}) {
    const value = Object.hasOwn(settings, 'targetWeeks') ? settings.targetWeeks : journey.targetWeeks;
    if (value !== undefined && value !== null && !['number', 'string'].includes(typeof value)) throw Error('Choose a target of 1–52 whole weeks, or leave it empty.');
    const targetWeeks = value === undefined || value === null || value === '' ? null : Number(value);
    if (targetWeeks !== null && (!Number.isInteger(targetWeeks) || targetWeeks < 1 || targetWeeks > 52)) throw Error('Choose a target of 1–52 whole weeks, or leave it empty.');
    return { targetWeeks, allowLaterFinish: (Object.hasOwn(settings, 'allowLaterFinish') ? settings.allowLaterFinish : journey.allowLaterFinish) === true, targetDate: targetWeeks ? plusDays(journey.startDate, targetWeeks * 7 - 1) : null };
  }
  function plannedFinish(journey, tasks, settings = {}, unscheduled = []) {
    const target = planningTarget(journey, settings), last = finishDate(tasks);
    const targetExceeded = !!target.targetDate && (unscheduled.length > 0 || !!last && last > target.targetDate);
    if (targetExceeded && !target.allowLaterFinish) throw Error('This plan cannot finish within the target ending ' + target.targetDate + '. Increase availability, reduce content, or allow a later finish.');
    return { ...target, finishDate: last, targetExceeded };
  }
  function fixedWarnings(tasks, availability, today) {
    const warnings = [], active = tasks.filter(t => !t.cancelledAt && t.date >= today), start = minutes(availability.startTime);
    for (const date of new Set(active.map(t => t.date))) {
      const dayTasks = active.filter(t => t.date === date), capacity = availability.days[new Date(date + 'T12:00:00Z').getUTCDay()] * 60;
      if (dayTasks.some(t => t.fixed && (minutes(t.startTime) < start || minutes(t.endTime) > start + capacity))) warnings.push('Fixed session on ' + date + ' is outside the preferred study window.');
      if (dayTasks.reduce((n, t) => n + t.minutes, 0) > capacity) warnings.push('Preserved work on ' + date + ' exceeds that day’s new capacity.');
    }
    return warnings;
  }

  const arrayLesson = { sourceId: 'dsa-arrays-v1', type: 'lesson', title: 'Arrays: a foundation for problem solving', topic: 'Arrays', duration: 35, description: 'Learn indexed access, traversal, and the cost of inserting elements.', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array', content: 'An array stores an ordered sequence of values. Indexed access retrieves a value directly. Traversal visits each value once.\n\nTo solve an array problem, first identify the input, the required output, and any constraints. A straightforward scan is often the best first solution.\n\nIn a contiguous array, inserting near the front can shift many elements. Be precise about the operations your algorithm performs before choosing a complexity bound.\n\nTry it: trace a scan of [4, 1, 4, 3] and record the values you have already seen. Which value repeats?' };
  const hashLesson = { sourceId: 'dsa-hash-v1', type: 'lesson', title: 'Hash maps and frequency counting', topic: 'Hash maps', duration: 45, description: 'Turn repeated searching into a lookup.', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map', content: 'A hash map associates a key with a value. Use it when you need to remember counts, positions, or previously seen information.\n\nFor a frequency counter, visit each input value, read its current count (zero if absent), and increment it. You make one pass through the input.\n\nHash collisions are normal. The data structure resolves them; your algorithm should still use exact key equality. Expected lookup is constant time, but this is not a promise about every possible implementation or input.\n\nTry it: count the letters in “learnio” and then in “learning”. Which keys have a count greater than one?' };
  const twoSum = { sourceId: 'neetcode-two-sum', type: 'problem', title: 'Two Sum', topic: 'Arrays', duration: 30, description: 'Find the indices of two numbers that add up to the target.', sourceUrl: 'https://neetcode.io/problems/two-integer-sum', content: 'Open the exact problem to read its full statement and constraints. Start with a brute-force solution, then consider a map of previously seen values. Returning from the problem site does not automatically mark this work complete.' };
  const duplicate = { sourceId: 'neetcode-contains-duplicate', type: 'problem', title: 'Contains Duplicate', topic: 'Arrays', duration: 25, description: 'Detect whether any value appears more than once.', sourceUrl: 'https://neetcode.io/problems/duplicate-integer', content: 'Think about the information needed while scanning the input once. A set can record values already seen. Complete and verify your solution on the source site, then record your manual completion here.' };
  const anagram = { sourceId: 'neetcode-valid-anagram', type: 'problem', title: 'Valid Anagram', topic: 'Hash maps', duration: 30, description: 'Compare character frequencies in two strings.', sourceUrl: 'https://neetcode.io/problems/is-anagram', content: 'A frequency map can compare counts of each character. Consider different lengths and repeated characters. This local planner does not receive a judge result.' };
  const pythonLesson = { sourceId: 'python-basics-v1', type: 'lesson', title: 'Python values, lists, and loops', topic: 'Python basics', duration: 30, description: 'Read and transform a small collection of values.', sourceUrl: 'https://docs.python.org/3/tutorial/introduction.html', content: 'Python names refer to objects. Numbers, strings, lists, and dictionaries help represent different kinds of information.\n\nA list holds an ordered collection. A for loop visits its elements. The len function returns its length. range produces a sequence of integers with an excluded stop value.\n\nAssignment binds a name; it does not automatically create a new copy of a list. Be careful when two names refer to the same mutable object.\n\nTry it: write a loop that adds the values in [2, 4, 6]. Compare your result with sum([2, 4, 6]).' };
  const functionLesson = { sourceId: 'python-functions-v1', type: 'lesson', title: 'Small functions with clear contracts', topic: 'Functions', duration: 40, description: 'Create reusable functions with arguments and return values.', sourceUrl: 'https://docs.python.org/3/tutorial/controlflow.html#defining-functions', content: 'A function names a reusable computation. Describe the expected inputs and outputs before writing its body.\n\nUse return to give a value back to the caller. Printing displays a value but does not replace a return statement.\n\nAvoid mutable default arguments when each call needs fresh state. Use a None default and create the list inside the function.\n\nTry it: write a function that returns the largest of three numbers. Check negative inputs and equal values.' };
  const CATALOGUE = [
    { id: 'dsa-course', type: 'course', title: 'Data structures, one pattern at a time', publisher: 'Asha Rao', publisherType: 'Educator', institution: 'Northstar University', topics: ['Arrays', 'Hash maps'], companies: [], level: 'Beginner', minutes: 80, description: 'A focused introduction to arrays, lookups, and choosing the right data structure.', outcomes: ['Explain array operation costs', 'Build a frequency map'], version: 1, items: [arrayLesson, hashLesson] },
    { id: 'python-course', type: 'course', title: 'Python for practical beginners', publisher: 'Noah Kim', publisherType: 'Educator', institution: '', topics: ['Python basics', 'Functions'], companies: [], level: 'Beginner', minutes: 70, description: 'Learn by reading, tracing, and writing small Python programs.', outcomes: ['Work with lists and loops', 'Write functions with clear return values'], version: 1, items: [pythonLesson, functionLesson] },
    { id: 'array-sheet', type: 'sheet', title: 'Essential array patterns', publisher: 'Riya Sharma', publisherType: 'Student contributor', institution: '', topics: ['Arrays'], companies: ['Google', 'Amazon'], companyNote: 'Illustrative interview relevance tags, not verified company question lists.', level: 'Beginner', minutes: 55, description: 'Two focused problems to practice scans and fast lookups.', outcomes: ['Recognize repeated values', 'Find target-sum pairs'], version: 1, items: [duplicate, twoSum] },
    { id: 'hash-sheet', type: 'sheet', title: 'Hash map practice', publisher: 'Asha Rao', publisherType: 'Educator', institution: 'Northstar University', topics: ['Hash maps'], companies: ['Microsoft'], companyNote: 'Illustrative interview relevance tag, not a verified company question list.', level: 'Intermediate', minutes: 30, description: 'Use a frequency counter to reason about string equality.', outcomes: ['Compare character frequencies'], version: 1, items: [anagram] },
    { id: 'dsa-journey', type: 'journey', title: 'DSA Interview Prep', publisher: 'Riya Sharma', publisherType: 'Student contributor', institution: '', topics: ['Arrays', 'Hash maps'], companies: [], level: 'Beginner', minutes: 165, description: 'A compact, versioned path from array foundations to hash-map practice.', outcomes: ['Learn a pattern', 'Solve the matching problems', 'Review your own evidence'], version: 1, items: [arrayLesson, duplicate, twoSum, hashLesson, anagram] },
    { id: 'python-journey', type: 'journey', title: 'Python Foundations', publisher: 'Noah Kim', publisherType: 'Educator', institution: '', topics: ['Python basics', 'Functions'], companies: [], level: 'Beginner', minutes: 90, description: 'Build confidence with Python values, loops, and functions.', outcomes: ['Trace simple programs', 'Write reusable functions'], version: 1, items: [pythonLesson, functionLesson, { sourceId: 'python-review-v1', type: 'review', title: 'Build a tiny study-time calculator', topic: 'Functions', duration: 20, description: 'Combine your new skills in a small program.', sourceUrl: 'https://docs.python.org/3/tutorial/', content: 'Write a function that accepts study-session lengths in minutes and returns the total hours. Test an empty list, one session, and several sessions. Record a reflection when you finish.' }] }
  ];

  function normalizeAvailability(input) {
    const result = clone({ ...DEFAULT_AVAILABILITY, ...input, days: input?.days || DEFAULT_AVAILABILITY.days });
    result.weeklyHours = Number(result.weeklyHours);
    if (!validTime(result.startTime)) throw Error('Choose a valid daily start time.');
    try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }); } catch { throw Error('Choose a valid timezone.'); }
    let total = 0;
    for (let day = 0; day < 7; day++) {
      const hours = Number(result.days[day] || 0);
      if (!Number.isFinite(hours) || hours < 0 || hours > 12 || !Number.isInteger(hours * 60)) throw Error('Daily availability must be between 0 and 12 hours in whole minutes.');
      if (minutes(result.startTime) + hours * 60 > 1440) throw Error('Daily study hours must finish before midnight.');
      result.days[day] = hours;
      total += hours;
    }
    if (!Number.isFinite(result.weeklyHours) || total <= 0 || Math.abs(total - result.weeklyHours) > 0.0001) throw Error('Per-day hours must add up to the weekly capacity, with at least one available day.');
    return result;
  }

  // ponytail: allocation searches at most 730 days per item; expose unscheduled work instead of claiming feasibility. Extend the horizon if longer plans become necessary.
  function allocate(journey, settings, today, makeId = id) {
    const availability = normalizeAvailability(settings);
    const cancelled = journey.tasks.filter(t => t.cancelledAt).map(clone);
    const tasks = journey.tasks.filter(t => !t.cancelledAt && (t.fixed || t.completedAt)).map(t => ({ ...clone(t), timezone: t.timezone || journey.availability?.timezone || availability.timezone }));
    if (tasks.some(t => t.fixed && !t.completedAt && t.timezone !== availability.timezone)) throw Error('Fixed sessions retain their original timezone. Keep this plan’s timezone while fixed sessions remain; changing your account timezone does not move them.');
    const warnings = fixedWarnings(tasks, availability, today);
    const unscheduled = [];
    const initial = journey.startDate > today ? journey.startDate : today;
    const start = minutes(availability.startTime);
    let cursor = initial;
    let cursorMinute = start;
    for (const item of journey.items) {
      if (item.completedAt || item.cancelledAt) continue;
      const preserved = tasks.filter(t => t.itemId === item.id);
      let remaining = Math.max(0, item.duration - preserved.reduce((n, t) => n + t.minutes, 0));
      if (preserved.some(t => t.fixed)) {
        const lastFixed = preserved.filter(t => t.fixed).sort((a, b) => (a.date + a.endTime).localeCompare(b.date + b.endTime)).at(-1);
        if (lastFixed.date > cursor || lastFixed.date === cursor && minutes(lastFixed.endTime) > cursorMinute) { cursor = lastFixed.date; cursorMinute = minutes(lastFixed.endTime); }
      }
      for (let guard = 0; remaining > 0 && guard < 730; guard++) {
        const dayCapacity = availability.days[new Date(cursor + 'T12:00:00Z').getUTCDay()] * 60;
        const occupied = tasks.filter(t => t.date === cursor).sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
        const used = occupied.reduce((n, t) => n + t.minutes, 0);
        let budget = Math.max(0, dayCapacity - used);
        let position = Math.max(start, cursorMinute);
        const end = start + dayCapacity;
        const intervals = [];
        for (const block of occupied) {
          if (minutes(block.endTime) <= position) continue;
          if (minutes(block.startTime) > position) intervals.push([position, Math.min(end, minutes(block.startTime))]);
          position = Math.max(position, minutes(block.endTime));
        }
        if (position < end) intervals.push([position, end]);
        for (const [from, to] of intervals) {
          const amount = Math.min(remaining, budget, Math.max(0, to - from));
          if (!amount) continue;
          tasks.push({ id: makeId('task'), itemId: item.id, date: cursor, startTime: time(from), endTime: time(from + amount), timezone: availability.timezone, minutes: amount, fixed: false, completedAt: null });
          budget -= amount;
          remaining -= amount;
          cursorMinute = from + amount;
          if (!remaining) break;
        }
        if (remaining) { cursor = plusDays(cursor, 1); cursorMinute = start; }
      }
      if (remaining) unscheduled.push({ itemId: item.id, minutes: remaining });
    }
    tasks.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const summary = plannedFinish(journey, tasks, settings, unscheduled);
    if (summary.targetExceeded) warnings.push('Estimated finish is later than your target ending ' + summary.targetDate + '.');
    return { availability, tasks: [...tasks, ...cancelled].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)), warnings, unscheduled, ...summary, totalMinutes: tasks.reduce((n, t) => n + t.minutes, 0) };
  }

  function createStore(options = {}) {
    const QUESTIONS = options.questions || [];
    const catalogue = options.catalogue || CATALOGUE;
    let storage;
    let persistenceError = '';
    try { storage = options.storage === undefined ? root.localStorage : options.storage; } catch { persistenceError = 'Browser storage is unavailable. Changes cannot be saved.'; }
    const now = () => new Date(options.now ? options.now() : Date.now());
    const stamp = () => now().toISOString();
    let state;
    const user = () => state.users.find(u => u.id === state.activeUserId) || null;
    const today = (timezone) => {
      const current = state.userData[state.activeUserId];
      const selected = current?.journeys.find(j => j.id === current.selectedJourneyId);
      return dateAt(now(), timezone || selected?.availability.timezone || user()?.timezone || 'Asia/Kolkata');
    };
    const data = (s = state) => {
      const d = s.userData[s.activeUserId];
      if (!d) throw Error('Sign in to your Learnio account first.');
      return d;
    };
    const findJourney = (d, journeyId) => { const j = d.journeys.find(x => x.id === (journeyId || d.selectedJourneyId)); if (!j) throw Error('This journey is not available in the current account.'); return j; };
    const findItem = (j, itemId) => { const item = j.items.find(i => i.id === itemId); if (!item) throw Error('This item is not part of this journey.'); if (item.cancelledAt) throw Error('This scheduled quiz was cancelled. Its history is preserved.'); return item; };
    const editable = (j, planning = false) => {
      if (j.status === 'archived') throw Error('Restore this archived journey before changing its learning records.');
      if (j.status === 'paused') throw Error('Resume this paused journey before changing its learning records. Existing dates and history have been preserved.');
      return j;
    };
    const copyItems = (source, ownerId, journeyId) => source.map(i => ({ ...clone(i), id: id('item'), ownerId, journeyId, sourceVersion: i.sourceVersion || 1, completedAt: null, note: '' }));
    function makeJourney(ownerId, fields = {}) {
      const title = String(fields.title || fields.name || '').trim();
      if (!title || title.length > 100) throw Error('Give your journey a name of 1–100 characters.');
      const journeyId = id('journey');
      const availability = normalizeAvailability(fields.availability || fields.schedule || { ...DEFAULT_AVAILABILITY, timezone: user()?.timezone || 'Asia/Kolkata' });
      const startDate = fields.startDate || today(availability.timezone);
      if (!validDate(startDate)) throw Error('Choose a valid start date.');
      return { id: journeyId, ownerId, name: title, title, goal: String(fields.goal || '').slice(0, 500), startDate, planningMode: fields.planningMode || 'availability', ...planningTarget({ startDate }, fields), status: 'active', sourceVersion: fields.sourceVersion || null, createdAt: stamp(), items: [], tasks: [], contentReferences: [], availability, schedule: availability, planRevision: 0, revisions: [] };
    }
    function schedule(j, settings = j.availability) {
      const preview = allocate(j, settings, today(settings.timezone || j.availability.timezone));
      j.revisions.push({ revision: j.planRevision, savedAt: stamp(), availability: clone(j.availability), tasks: clone(j.tasks) });
      j.revisions = j.revisions.slice(-5);
      j.planRevision++;
      j.availability = preview.availability;
      j.schedule = preview.availability;
      j.tasks = preview.tasks;
      j.unscheduled = preview.unscheduled;
      j.scheduleWarnings = preview.warnings;
      Object.assign(j, planningTarget(j, settings), { finishDate: preview.finishDate });
      return preview;
    }
    function add(j, entry) {
      const existing = new Set(j.items.map(i => i.sourceId));
      const newItems = entry.items.filter(i => !existing.has(i.sourceId));
      if (newItems.some(i => !Number.isInteger(i.duration) || i.duration < 1 || i.duration > 10080)) throw Error('Learning items need valid durations in whole minutes.');
      j.items.push(...copyItems(newItems.map(i => ({ ...i, sourceVersion: entry.version, sourceCourseId: entry.type === 'course' ? entry.id : i.sourceCourseId || null })), j.ownerId, j.id));
      if (!j.contentReferences.some(ref => ref.id === entry.id && ref.version === entry.version)) j.contentReferences.push({ id: entry.id, version: entry.version, type: entry.type, title: entry.title, addedAt: stamp() });
      return newItems.length;
    }
    function seed() {
      const users = [
        { id: 'riya', username: 'riya_learns', displayName: 'Riya Sharma', email: 'riya@example.test', educator: false },
        { id: 'asha', username: 'asha_teaches', displayName: 'Asha Rao', email: 'asha@example.test', educator: true },
        { id: 'maya', username: 'northstar_admin', displayName: 'Maya Patel', email: 'maya@example.test', educator: false }
      ].map(u => ({ ...u, timezone: 'Asia/Kolkata', bio: '', demo: true, createdAt: stamp() }));
      const result = { version: VERSION, revision: 0, activeUserId: null, users, reservedUsernames: ['northstar_university'], userData: {} };
      state = result;
      for (const u of users) {
        const journeys = ['dsa-journey', 'python-journey'].map(sourceId => {
          const entry = CATALOGUE.find(c => c.id === sourceId);
          const j = makeJourney(u.id, { title: entry.title, goal: entry.description, sourceVersion: { id: entry.id, version: entry.version } });
          add(j, entry);
          const initial = j.items[0];
          initial.completedAt = plusDays(today(), -1) + 'T12:00:00.000Z';
          j.tasks.push({ id: id('task'), itemId: initial.id, date: plusDays(today(), -1), startTime: '18:00', endTime: time(1080 + initial.duration), minutes: initial.duration, fixed: false, completedAt: initial.completedAt });
          schedule(j);
          return j;
        });
        const evidence = journeys.map(j => ({ id: id('evidence'), ownerId: u.id, journeyId: j.id, itemId: j.items[0].id, taskId: j.tasks.find(t => t.itemId === j.items[0].id).id, source: 'sample', sourceLabel: 'Sample completion', verification: 'Sample record', note: 'Seeded demonstration record. No external activity was verified.', url: '', completedAt: j.items[0].completedAt, observedAt: j.items[0].completedAt, sample: true }));
        result.userData[u.id] = { selectedJourneyId: journeys[0].id, journeys, evidence, attempts: [], draft: null, enrollments: [], memberships: [{ id: 'northstar-' + u.id, institutionId: 'northstar', institutionName: 'Northstar University', status: 'sample', role: u.id === 'maya' ? 'administrator' : u.educator ? 'educator' : 'student', scope: u.id === 'maya' ? 'institution' : 'course', courseIds: ['cs-201'], verified: false, source: 'Local sample; no institutional access is verified' }] };
      }
      return result;
    }
    try {
      const saved = storage?.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version !== VERSION || !Array.isArray(parsed.users) || !parsed.userData || !Array.isArray(parsed.reservedUsernames) || !Number.isInteger(parsed.revision)) throw Error('Unsupported saved data.');
        for (const savedUser of parsed.users) {
          const savedData = parsed.userData[savedUser.id];
          if (!savedData || !['journeys', 'attempts', 'evidence', 'enrollments', 'memberships'].every(key => Array.isArray(savedData[key]))) throw Error('Incomplete saved account.');
          if (savedData.journeys.some(j => j.ownerId !== savedUser.id || !Array.isArray(j.items) || !Array.isArray(j.tasks) || !j.availability)) throw Error('Incomplete saved journey.');
        }
        if (parsed.activeUserId && !parsed.users.some(u => u.id === parsed.activeUserId)) throw Error('Saved account not found.');
        state = parsed;
      } else state = options.seed === true ? seed() : { version: VERSION, revision: 0, activeUserId: null, users: [], reservedUsernames: [], userData: {} };
    } catch { state = { version: VERSION, revision: 0, activeUserId: null, users: [], reservedUsernames: [], userData: {} }; persistenceError = 'Saved data could not be read. Existing storage has been preserved; changes are disabled.'; }
    if (!storage) persistenceError ||= 'Browser storage is unavailable. Changes cannot be saved.';

    function transact(change) {
      if (persistenceError) return { ok: false, error: persistenceError };
      const before = state;
      try {
        const latest = storage.getItem(KEY);
        if (latest && JSON.parse(latest).revision > state.revision) return { ok: false, error: 'Learning data changed in another tab. Reload before saving to avoid overwriting it.' };
        const next = clone(state);
        const value = change(next) || {};
        next.revision++;
        storage.setItem(KEY, JSON.stringify(next));
        state = next;
        return { ok: true, ...value };
      } catch (error) {
        state = before;
        return { ok: false, error: /quota|storage|denied/i.test(error.message) ? 'Browser storage could not save this change. Free some space or allow site storage, then retry.' : error.message || 'The change could not be saved.' };
      }
    }
    const publicUser = u => { if (!u) return null; const { credentials, ...safe } = u; return clone(safe); };
    const catalogEntry = entryId => { const entry = catalogue.find(c => c.id === entryId); if (!entry) throw Error('This catalogue item is unavailable.'); return entry; };
    const normalizedUsername = value => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!/^[a-z][a-z0-9_]{2,29}$/.test(normalized)) throw Error('Use 3–30 characters: start with a letter, then letters, numbers, or underscores.');
      return normalized;
    };
    function validateIdentity(s, fields, currentId) {
      const username = normalizedUsername(fields.username);
      if (s.users.some(u => u.id !== currentId && u.username === username) || s.reservedUsernames.includes(username)) throw Error('That username is already taken. Choose another globally unique handle.');
      const displayName = String(fields.displayName || '').trim();
      if (!displayName || displayName.length > 80) throw Error('Enter a display name of 1–80 characters.');
      const email = String(fields.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid email address.');
      const timezone = fields.timezone || 'Asia/Kolkata';
      try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw Error('Choose a valid timezone.'); }
      return { username, displayName, email, timezone, educator: !!fields.educator, bio: String(fields.bio || '').slice(0, 1000) };
    }
    async function passwordHash(password, salt, iterations = PASSWORD_ITERATIONS) {
      if (!globalThis.crypto?.subtle) throw Error('This browser needs localhost or HTTPS to save demo credentials securely.');
      const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' }, key, 256);
      return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, '0')).join('');
    }
    async function passwordCredentials(password) {
      const salt = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
      return { algorithm: 'PBKDF2-SHA256', iterations: PASSWORD_ITERATIONS, salt, hash: await passwordHash(password, salt) };
    }
    function writeEvidence(d, j, item, details = {}) {
      const url = String(details.url || '').trim();
      if (url && !/^https?:\/\//i.test(url)) throw Error('Evidence links must use http or https.');
      if (url) { try { new URL(url); } catch { throw Error('Enter a valid evidence link.'); } }
      const source = details.source || (item.type === 'lesson' ? 'module' : 'manual');
      if (!['manual', 'module', 'quiz'].includes(source)) throw Error('Only local manual, lesson, or quiz completion is supported. External verification is not connected.');
      if (source === 'module' && item.type !== 'lesson' || source === 'quiz' && item.type !== 'quiz') throw Error('This completion source does not match the learning item.');
      if (details.eventId && source !== 'quiz') throw Error('Completion event identifiers are assigned by Learnio.');
      const existing = details.eventId && d.evidence.find(e => e.eventId === details.eventId);
      if (existing) {
        if (existing.journeyId !== j.id || existing.itemId !== item.id || existing.source !== source) throw Error('This completion event belongs to a different learning item.');
        return;
      }
      d.evidence.push({ id: id('evidence'), ownerId: j.ownerId, journeyId: j.id, itemId: item.id, taskId: details.taskId || null, eventId: details.eventId || null, source, sourceLabel: source === 'module' ? 'Lesson completed' : source === 'quiz' ? 'Quiz submitted' : 'Manually completed', verification: source === 'quiz' ? 'Server scored' : 'Learner confirmed', note: String(details.note || '').slice(0, 2000), url, completedAt: stamp(), observedAt: stamp(), sample: false });
    }
    function finishItem(d, j, item, details = {}) {
      editable(j);
      if (item.completedAt) return;
      writeEvidence(d, j, item, details);
      if (details.note !== undefined) item.note = String(details.note).slice(0, 2000);
      item.completedAt = stamp();
      for (const t of j.tasks.filter(t => t.itemId === item.id)) t.completedAt ||= item.completedAt;
    }
    function taskStatus(j, task) {
      if (task.completedAt) return 'Completed';
      if (j.tasks.some(t => t.itemId === task.itemId && t.completedAt)) return task.date < today(task.timezone || j.availability.timezone) ? 'Partially complete - delayed' : 'Partially complete - ahead';
      return 'Planned';
    }
    function importedJourney(fields) {
      if (!Array.isArray(fields.items) || !fields.items.length || fields.items.length > 1000) throw Error('Import between 1 and 1,000 plan items.');
      const j = makeJourney(state.activeUserId, { ...fields, planningMode: 'csv-import' });
      for (const [index, value] of fields.items.entries()) {
        const title = String(value.title || '').trim(), topic = String(value.topic || '').trim(), duration = Number(value.minutes);
        if (!['lesson', 'problem', 'review'].includes(value.type) || !title || title.length > 200 || !topic || topic.length > 80 || !Number.isInteger(duration) || duration < 1 || duration > 1440) throw Error('Imported item ' + (index + 1) + ' needs a type, title, topic, and whole-minute duration from 1 to 1,440.');
        const sourceUrl = String(value.url || '').trim();
        if (sourceUrl) { const parsed = new URL(sourceUrl); if (!['http:', 'https:'].includes(parsed.protocol)) throw Error('Imported resources must use http or https links.'); }
        const item = { id: id('item'), ownerId: j.ownerId, journeyId: j.id, sourceId: 'import-' + fields.fingerprint + '-' + index, sourceVersion: 1, type: value.type, title, topic, duration, sourceUrl, description: 'Personal learning item imported from CSV.', content: 'This item comes from your imported plan. Open the source link when one is provided, and record your learning notes here. Completion is learner-confirmed; importing does not verify external work.', completedAt: null, note: '' };
        j.items.push(item);
        if (value.fixed) {
          if (!validDate(value.date) || !validTime(value.startTime) || value.date < today(j.availability.timezone) || value.date < j.startDate || minutes(value.startTime) + duration > 1440) throw Error('Fixed item ' + (index + 1) + ' needs a date on or after the plan start and today, and must finish before midnight.');
          const from = minutes(value.startTime), to = from + duration;
          if (j.tasks.some(t => t.date === value.date && from < minutes(t.endTime) && to > minutes(t.startTime))) throw Error('Fixed sessions overlap on ' + value.date + '. Correct the CSV before importing.');
          j.tasks.push({ id: id('task'), itemId: item.id, date: value.date, startTime: value.startTime, endTime: time(to), timezone: j.availability.timezone, minutes: duration, fixed: true, completedAt: null });
        } else if (value.date || value.startTime) throw Error('Dates and times are only supported for fixed CSV sessions.');
      }
      const plan = schedule(j);
      j.importFingerprint = fields.fingerprint;
      return { journey: j, plan };
    }
    function quizSchedule(j, fields, taskId) {
      const duration = Number(fields.minutes ?? 10), startTime = fields.startTime || '19:00';
      if (!validDate(fields.date) || fields.date < today(j.availability.timezone) || !validTime(startTime) || !Number.isInteger(duration) || duration < 1 || duration > 120 || minutes(startTime) + duration > 1440) throw Error('Choose a valid date from today onward in the plan timezone, and a duration of 1–120 minutes.');
      if (!Array.isArray(fields.topics)) throw Error('Select topics included in this journey.');
      const topics = [...new Set(fields.topics)];
      if (!topics.length || topics.some(topic => !j.items.some(i => !i.cancelledAt && i.topic === topic && i.type !== 'quiz'))) throw Error('Select topics included in this journey.');
      const difficulty = fields.difficulty || 'Beginner';
      if (!['Beginner', 'Intermediate'].includes(difficulty)) throw Error('Choose Beginner or Intermediate difficulty.');
      const others = j.tasks.filter(t => !t.cancelledAt && t.id !== taskId);
      if (others.some(t => t.date === fields.date && minutes(startTime) < minutes(t.endTime) && minutes(startTime) + duration > minutes(t.startTime))) throw Error('That quiz time overlaps an existing study session.');
      const capacity = j.availability.days[new Date(fields.date + 'T12:00:00Z').getUTCDay()] * 60;
      if (others.filter(t => t.date === fields.date).reduce((n, t) => n + t.minutes, 0) + duration > capacity) throw Error('This quiz would exceed the day’s study capacity. Choose another day or increase availability first.');
      const task = { date: fields.date, startTime, endTime: time(minutes(startTime) + duration), timezone: j.availability.timezone, minutes: duration };
      const summary = plannedFinish(j, [...others, task]);
      const warnings = fixedWarnings([...others, { ...task, fixed: true }], j.availability, today(j.availability.timezone));
      if (summary.targetExceeded) warnings.push('Estimated finish is later than your target ending ' + summary.targetDate + '.');
      return { task, topics, difficulty, duration, warnings, finishDate: summary.finishDate };
    }
    function ownScheduledQuiz(j, itemId) {
      const item = findItem(j, itemId), tasks = j.tasks.filter(t => t.itemId === item.id && !t.cancelledAt);
      if (item.type !== 'quiz' || tasks.length !== 1 || !tasks[0].fixed) throw Error('Choose a personal scheduled quiz.');
      if (item.completedAt || tasks[0].completedAt) throw Error('Completed quiz history cannot be moved or cancelled.');
      return { item, task: tasks[0] };
    }
    const api = {
      storageKey: KEY, version: VERSION, catalogue: clone(catalogue), questions: clone(QUESTIONS), defaults: clone(DEFAULT_AVAILABILITY),
      today, plusDays,
      getPersistence: () => ({ available: !persistenceError, error: persistenceError }),
      getState: () => { const s = clone(state); s.users = s.users.map(publicUser); return s; },
      getUser: () => publicUser(user()),
      getData: () => user() ? clone(data()) : null,
      getJourneys: () => user() ? clone(data().journeys.map(j => ({ ...j, finishDate: finishDate(j.tasks) }))) : [],
      getJourney: journeyId => { try { const j = findJourney(data(), journeyId); return clone({ ...j, finishDate: finishDate(j.tasks) }); } catch { return null; } },
      getEvidence: journeyId => user() ? clone(data().evidence.filter(e => e.journeyId === (journeyId || data().selectedJourneyId))) : [],
      getAttempts: journeyId => user() ? clone(data().attempts.filter(a => a.journeyId === (journeyId || data().selectedJourneyId))) : [],
      getAttempt: attemptId => user() ? clone(data().attempts.find(a => a.id === attemptId) || null) : null,
      getCoveredTopics: journeyId => { const j = api.getJourney(journeyId); return j ? [...new Set(j.items.filter(i => i.completedAt && i.type !== 'quiz').map(i => i.topic))] : []; },
      getTasks(journeyId, date) {
        const j = api.getJourney(journeyId);
        return j ? j.tasks.filter(t => !t.cancelledAt && (!date || t.date === date)).map(t => { const item = j.items.find(i => i.id === t.itemId); return { ...t, timezone: t.timezone || j.availability.timezone, item, title: item.title, type: item.type, topic: item.topic, status: taskStatus(j, t), overdue: !t.completedAt && t.date < today(t.timezone || j.availability.timezone), paused: j.status === 'paused', archived: j.status === 'archived' }; }) : [];
      },
      async login(username, password) {
        try {
          const found = state.users.find(u => u.username === String(username || '').trim().toLowerCase());
          const credentials = found?.credentials;
          const valid = typeof password === 'string' && password.length <= 256 && found && (credentials ?
            credentials.algorithm === 'PBKDF2-SHA256' && Number.isInteger(credentials.iterations) && credentials.iterations >= 120000 && credentials.iterations <= PASSWORD_ITERATIONS &&
            typeof credentials.salt === 'string' && credentials.salt.length > 0 && credentials.salt.length <= 128 && /^[a-f0-9]{64}$/.test(credentials.hash) &&
            await passwordHash(password, credentials.salt, credentials.iterations) === credentials.hash : options.seed === true && found.demo && password === 'demo123');
          if (!valid) return { ok: false, error: 'Username or password is incorrect.' };
          const upgraded = credentials && credentials.iterations < PASSWORD_ITERATIONS ? await passwordCredentials(password) : null;
          return transact(s => { const u = s.users.find(u => u.id === found.id); if (upgraded) u.credentials = upgraded; s.activeUserId = u.id; return { user: publicUser(u) }; });
        } catch (error) { return { ok: false, error: error.message }; }
      },
      async register(fields) {
        try {
          const identity = validateIdentity(state, fields);
          if (typeof fields.password !== 'string' || fields.password.length < 8 || fields.password.length > 256) throw Error('Use a password between 8 and 256 characters.');
          const credentials = await passwordCredentials(fields.password);
          return transact(s => {
            validateIdentity(s, identity);
            const u = { ...identity, id: id('user'), demo: false, emailVerified: false, createdAt: stamp(), credentials };
            s.users.push(u); s.activeUserId = u.id;
            s.userData[u.id] = { selectedJourneyId: null, journeys: [], evidence: [], attempts: [], draft: null, enrollments: [], memberships: [] };
            return { user: publicUser(u) };
          });
        } catch (error) { return { ok: false, error: error.message }; }
      },
      logout: () => transact(s => { s.activeUserId = null; }),
      updateSettings: fields => transact(s => { const u = s.users.find(u => u.id === s.activeUserId); if (!u) throw Error('Sign in first.'); Object.assign(u, validateIdentity(s, { ...u, ...fields }, u.id)); return { user: publicUser(u) }; }),
      selectJourney: journeyId => transact(s => { const d = data(s); findJourney(d, journeyId); d.selectedJourneyId = journeyId; }),
      saveDraft: fields => transact(s => { const d = data(s); d.draft = { ...(d.draft || {}), ...clone(fields), savedAt: stamp() }; }),
      clearDraft: () => transact(s => { data(s).draft = null; }),
      previewJourney: fields => {
        try {
          data();
          const entry = fields.entryId ? catalogEntry(fields.entryId) : null;
          const j = makeJourney(state.activeUserId, { ...fields, title: fields.title || entry?.title, goal: fields.goal || entry?.description });
          for (const entryId of entry ? [entry.id] : fields.contentIds || []) add(j, catalogEntry(entryId));
          const preview = allocate(j, j.availability, today(j.availability.timezone));
          return { ok: true, ...preview, tasks: preview.tasks.map(t => { const item = j.items.find(i => i.id === t.itemId); return { ...t, title: item.title, type: item.type, topic: item.topic }; }) };
        } catch (error) { return { ok: false, error: error.message }; }
      },
      createJourney: fields => transact(s => {
        const d = data(s); const j = makeJourney(s.activeUserId, fields);
        for (const entryId of fields.contentIds || []) {
          const entry = catalogEntry(entryId); add(j, entry);
          if (entry.type === 'course' && !d.enrollments.some(e => e.contentId === entry.id)) d.enrollments.push({ id: id('enrollment'), ownerId: s.activeUserId, contentId: entry.id, version: entry.version, enrolledAt: stamp(), mode: 'self-paced' });
        }
        schedule(j); d.journeys.push(j); d.selectedJourneyId = j.id; d.draft = null;
        return { journeyId: j.id };
      }),
      previewPlan: fields => {
        try {
          const d = data();
          const existing = d.journeys.find(j => j.importFingerprint === fields.fingerprint);
          if (existing) return { ok: true, journeyId: existing.id, alreadyImported: true, totalMinutes: existing.items.filter(i => !i.cancelledAt).reduce((n, i) => n + i.duration, 0), finishDate: finishDate(existing.tasks), tasksCount: existing.tasks.filter(t => !t.cancelledAt).length, warnings: existing.scheduleWarnings || [], unscheduled: existing.unscheduled || [] };
          const { plan } = importedJourney(fields);
          return { ok: true, alreadyImported: false, totalMinutes: plan.totalMinutes, finishDate: plan.finishDate, tasksCount: plan.tasks.length, warnings: plan.warnings, unscheduled: plan.unscheduled };
        } catch (error) { return { ok: false, error: error.message }; }
      },
      importPlan: fields => transact(s => {
        const d = data(s);
        const existing = d.journeys.find(j => j.importFingerprint === fields.fingerprint);
        if (existing) { d.selectedJourneyId = existing.id; return { journeyId: existing.id, alreadyImported: true, warnings: existing.scheduleWarnings || [], unscheduled: existing.unscheduled || [] }; }
        if (!/^[a-f0-9]{64}$/.test(fields.fingerprint || '')) throw Error('The import fingerprint is invalid.');
        const { journey: j, plan } = importedJourney(fields);
        d.journeys.push(j); d.selectedJourneyId = j.id;
        return { journeyId: j.id, alreadyImported: false, warnings: plan.warnings, unscheduled: plan.unscheduled };
      }),
      addContent: (entryId, journeyId) => transact(s => {
        const d = data(s); const j = editable(findJourney(d, journeyId), true); const entry = catalogEntry(entryId); const added = add(j, entry);
        if (entry.type === 'course' && !d.enrollments.some(e => e.contentId === entry.id)) d.enrollments.push({ id: id('enrollment'), ownerId: s.activeUserId, contentId: entry.id, version: entry.version, enrolledAt: stamp(), mode: 'self-paced' });
        if (added) schedule(j);
        return { journeyId: j.id, added };
      }),
      addStudyReference: (journeyId, fields) => transact(s => {
        const j = editable(findJourney(data(s), journeyId), true), title = String(fields.title || '').trim(), topic = String(fields.topic || '').trim(), duration = Number(fields.minutes), reference = fields.reference || {};
        if (!title || title.length > 200 || !topic || topic.length > 80 || !Number.isInteger(duration) || duration < 1 || duration > 600 || typeof fields.minutes === 'boolean') throw Error('Study time needs a title, topic, and duration of 1–600 whole minutes.');
        const keys = ['materialId', 'assignmentId'].filter(key => Object.hasOwn(reference, key));
        if (typeof reference.courseId !== 'string' || !reference.courseId.trim() || reference.courseId.length > 200 || keys.length !== 1 || typeof reference[keys[0]] !== 'string' || !reference[keys[0]].trim() || reference[keys[0]].length > 200) throw Error('Choose one course material or assignment for this study session.');
        const sourceUrl = String(fields.sourceUrl || '').trim();
        if (sourceUrl && !['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw Error('Study resource links must use http or https.');
        const item = { id: id('item'), ownerId: j.ownerId, journeyId: j.id, sourceId: id('study-reference'), sourceVersion: 1, title, topic, duration, type: 'review', studyReference: { courseId: reference.courseId, [keys[0]]: reference[keys[0]] }, sourceUrl, description: 'Private preparation time. Completing this session does not submit or complete official coursework.', content: '', completedAt: null, note: '' };
        j.items.push(item);
        const plan = schedule(j);
        if (plan.unscheduled.length) throw Error('This study time cannot fit the scheduling horizon. Increase availability before adding it.');
        return { journeyId: j.id, itemId: item.id, warnings: plan.warnings, finishDate: plan.finishDate };
      }),
      adoptJourney: (entryId, fields = {}) => transact(s => {
        const entry = catalogEntry(entryId); if (entry.type !== 'journey') throw Error('Choose a published journey template.');
        const d = data(s); const j = makeJourney(s.activeUserId, { ...fields, title: fields.title || entry.title, goal: fields.goal || entry.description, sourceVersion: { id: entry.id, version: entry.version, publisher: entry.publisher } });
        add(j, entry); schedule(j); d.journeys.push(j); d.selectedJourneyId = j.id;
        return { journeyId: j.id };
      }),
      updateJourney: (journeyId, fields) => transact(s => {
        const j = findJourney(data(s), journeyId);
        const previousStatus = j.status;
        if (fields.status !== undefined) { if (!['active', 'paused', 'archived'].includes(fields.status)) throw Error('Invalid journey status.'); j.status = fields.status; }
        if (fields.title !== undefined || fields.name !== undefined || fields.goal !== undefined) editable(j);
        if (fields.title !== undefined || fields.name !== undefined) { const title = String(fields.title ?? fields.name).trim(); if (!title || title.length > 100) throw Error('Enter a journey name of 1–100 characters.'); j.title = j.name = title; }
        if (fields.goal !== undefined) j.goal = String(fields.goal).slice(0, 500);
        if (previousStatus !== 'active' && j.status === 'active') return schedule(j);
      }),
      duplicateJourney: journeyId => transact(s => {
        const d = data(s); const source = findJourney(d, journeyId); const j = makeJourney(s.activeUserId, { title: source.title.slice(0, 93) + ' (copy)', goal: source.goal, availability: source.availability, sourceVersion: source.sourceVersion });
        j.items = copyItems(source.items.filter(i => !i.cancelledAt), s.activeUserId, j.id); j.contentReferences = clone(source.contentReferences); schedule(j); d.journeys.push(j); d.selectedJourneyId = j.id;
        return { journeyId: j.id };
      }),
      completeItem: (journeyId, itemId, details = {}) => transact(s => { const d = data(s); const j = findJourney(d, journeyId); const item = findItem(j, itemId); if (item.type === 'quiz') throw Error('Submit the quiz attempt to complete this item.'); finishItem(d, j, item, details); }),
      completeTask: (journeyId, taskId, details = {}) => transact(s => {
        const d = data(s); const j = editable(findJourney(d, journeyId)); const t = j.tasks.find(t => t.id === taskId); if (!t) throw Error('Task not found.'); const item = findItem(j, t.itemId);
        if (item.type === 'quiz') throw Error('Submit the quiz attempt to complete this task.');
        if (t.completedAt) return;
        writeEvidence(d, j, item, { ...details, source: item.type === 'lesson' ? 'module' : 'manual', taskId: t.id }); t.completedAt = stamp();
        if (details.note !== undefined) item.note = String(details.note).slice(0, 2000);
        if (j.tasks.filter(x => x.itemId === item.id && x.completedAt).reduce((n, x) => n + x.minutes, 0) >= item.duration) item.completedAt = stamp();
      }),
      reopenItem: (journeyId, itemId) => transact(s => {
        const d = data(s); const j = editable(findJourney(d, journeyId)); const item = findItem(j, itemId); item.completedAt = null;
        for (const t of j.tasks.filter(t => t.itemId === itemId)) t.completedAt = null;
        for (const e of d.evidence.filter(e => e.journeyId === j.id && e.itemId === itemId && !e.correctedAt)) e.correctedAt = stamp();
      }),
      saveNote: (journeyId, itemId, note) => transact(s => { findItem(editable(findJourney(data(s), journeyId)), itemId).note = String(note).slice(0, 5000); }),
      previewSchedule: (journeyId, settings) => { try { const j = editable(findJourney(data(), journeyId), true); return { ok: true, ...allocate(j, settings, today(settings.timezone || j.availability.timezone)) }; } catch (error) { return { ok: false, error: error.message }; } },
      saveSchedule: (journeyId, settings) => transact(s => { const j = editable(findJourney(data(s), journeyId), true); return schedule(j, settings); }),
      rescheduleTask: (journeyId, taskId, date, startTime) => transact(s => {
        const j = editable(findJourney(data(s), journeyId), true); const t = j.tasks.find(t => t.id === taskId); if (!t) throw Error('Task not found.');
        if (t.fixed || t.completedAt) throw Error('Fixed sessions and completed history cannot be moved.');
        if (!validDate(date) || !validTime(startTime) || date < today(j.availability.timezone)) throw Error('Choose a valid date from today onward in the plan timezone, and a valid time.');
        const from = minutes(startTime), to = from + t.minutes, dayStart = minutes(j.availability.startTime), capacity = j.availability.days[new Date(date + 'T12:00:00Z').getUTCDay()] * 60;
        const others = j.tasks.filter(x => !x.cancelledAt && x.date === date && x.id !== taskId);
        if (from < dayStart || to > dayStart + capacity || others.reduce((n, x) => n + x.minutes, 0) + t.minutes > capacity) throw Error('This session does not fit the day’s study availability.');
        if (others.some(x => from < minutes(x.endTime) && to > minutes(x.startTime))) throw Error('This time overlaps another session.');
        plannedFinish(j, j.tasks.map(x => x.id === taskId ? { ...x, date } : x));
        t.date = date; t.startTime = startTime; t.endTime = time(to); t.timezone = j.availability.timezone; j.planRevision++;
        j.tasks.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
      }),
      scheduleQuiz: fields => transact(s => {
        const j = editable(findJourney(data(s), fields.journeyId), true), plan = quizSchedule(j, fields), { topics, duration } = plan;
        const item = { id: id('item'), ownerId: j.ownerId, journeyId: j.id, sourceId: id('local-quiz'), sourceVersion: 1, title: fields.title || topics.join(' & ') + ' check-in', type: 'quiz', topic: topics[0], topics, difficulty: fields.difficulty || 'Beginner', duration, description: 'Scheduled practice from the built-in question bank. Eligible covered topics are checked when you start.', content: '', completedAt: null, note: '' };
        j.items.push(item); j.tasks.push({ id: id('task'), itemId: item.id, ...plan.task, fixed: true, completedAt: null });
        j.tasks.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
        j.scheduleWarnings = plan.warnings;
        j.finishDate = plan.finishDate;
        j.planRevision++; return { itemId: item.id, warnings: plan.warnings };
      }),
      updateScheduledQuiz: (journeyId, itemId, fields) => transact(s => {
        const d = data(s), j = editable(findJourney(d, journeyId), true), { item, task } = ownScheduledQuiz(j, itemId);
        if (d.attempts.some(a => a.journeyId === j.id && a.itemId === item.id && a.status === 'in-progress')) throw Error('Finish or discard the open attempt before changing this quiz.');
        const plan = quizSchedule(j, { date: task.date, startTime: task.startTime, minutes: item.duration, topics: item.topics || [item.topic], difficulty: item.difficulty, ...fields }, task.id);
        const title = item.title === (item.topics || [item.topic]).join(' & ') + ' check-in' ? plan.topics.join(' & ') + ' check-in' : item.title;
        Object.assign(item, { topics: plan.topics, topic: plan.topics[0], difficulty: plan.difficulty, duration: plan.duration, title });
        Object.assign(task, plan.task);
        j.tasks.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
        j.scheduleWarnings = plan.warnings; j.finishDate = plan.finishDate; j.planRevision++;
        return { itemId: item.id, warnings: plan.warnings };
      }),
      cancelScheduledQuiz: (journeyId, itemId) => transact(s => {
        const d = data(s), j = editable(findJourney(d, journeyId), true), existing = j.items.find(i => i.id === itemId);
        if (existing?.cancelledAt) return { itemId, alreadyCancelled: true };
        const { item, task } = ownScheduledQuiz(j, itemId), cancelledAt = stamp();
        item.cancelledAt = cancelledAt; task.cancelledAt = cancelledAt;
        for (const a of d.attempts.filter(a => a.journeyId === j.id && a.itemId === item.id && a.status === 'in-progress')) { a.status = 'abandoned'; a.endedAt = cancelledAt; a.cancelledAt = cancelledAt; }
        const summary = plannedFinish(j, j.tasks);
        j.scheduleWarnings = fixedWarnings(j.tasks, j.availability, today(j.availability.timezone));
        if (summary.targetExceeded) j.scheduleWarnings.push('Estimated finish is later than your target ending ' + summary.targetDate + '.');
        j.finishDate = summary.finishDate; j.planRevision++;
        return { itemId };
      }),
      startQuiz: fields => transact(s => {
        const d = data(s); const j = editable(findJourney(d, fields.journeyId)); const item = fields.itemId ? findItem(j, fields.itemId) : null;
        if (item && item.type !== 'quiz') throw Error('This item is not a quiz.');
        const existing = d.attempts.find(a => a.journeyId === j.id && a.status === 'in-progress' && (item ? a.itemId === item.id : !a.itemId));
        if (existing) return { attemptId: existing.id, resumed: true };
        const topics = [...new Set(item?.topics || fields.topics || [])], covered = new Set(j.items.filter(i => i.completedAt && i.type !== 'quiz').map(i => i.topic));
        if (!topics.length || topics.some(topic => !covered.has(topic))) throw Error('Complete learning in every selected topic first, or choose covered topics.');
        const difficulty = item?.difficulty || fields.difficulty || 'Beginner';
        const questions = QUESTIONS.filter(q => topics.includes(q.topic) && q.difficulty === difficulty);
        if (!questions.length || topics.some(topic => !questions.some(q => q.topic === topic))) throw Error('The built-in question bank has no questions for this topic and difficulty.');
        const duration = Number(item?.duration ?? fields.minutes ?? 10);
        if (!Number.isInteger(duration) || duration < 0 || duration > 120) throw Error('Choose an untimed quiz (0) or a duration of 1–120 minutes.');
        const attempt = { id: id('attempt'), ownerId: j.ownerId, journeyId: j.id, itemId: item?.id || null, topics, difficulty, minutes: duration, generator: 'Learnio starter question bank v1', questions: clone(questions), answers: {}, marked: [], status: 'in-progress', startedAt: stamp(), expiresAt: duration ? new Date(now().getTime() + duration * 60000).toISOString() : null, submittedAt: null, result: null };
        d.attempts.push(attempt); return { attemptId: attempt.id };
      }),
      answerQuiz: (attemptId, questionId, optionIndex) => transact(s => {
        const a = data(s).attempts.find(a => a.id === attemptId); if (!a || a.status !== 'in-progress') throw Error('This attempt is no longer open.');
        editable(findJourney(data(s), a.journeyId));
        if (a.expiresAt && now().getTime() >= Date.parse(a.expiresAt)) throw Error('Time is up. Submit your saved answers to see the result.');
        const q = a.questions.find(q => q.id === questionId); if (!q || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length) throw Error('Select a valid answer.');
        a.answers[questionId] = optionIndex; a.savedAt = stamp();
      }),
      markQuestion: (attemptId, questionId, marked) => transact(s => { const a = data(s).attempts.find(a => a.id === attemptId); if (!a || a.status !== 'in-progress' || !a.questions.some(q => q.id === questionId)) throw Error('Question not available.'); editable(findJourney(data(s), a.journeyId)); a.marked = a.marked.filter(x => x !== questionId); if (marked) a.marked.push(questionId); }),
      submitQuiz: attemptId => transact(s => {
        const d = data(s); const a = d.attempts.find(a => a.id === attemptId); if (!a) throw Error('Attempt not found.');
        if (a.status === 'submitted') return { attempt: clone(a) };
        if (a.status !== 'in-progress') throw Error('This attempt is closed. Start a new quiz to try again.');
        editable(findJourney(d, a.journeyId));
        if (!Object.keys(a.answers).length) throw Error('Answer at least one question before submitting. Empty attempts do not receive a score.');
        const result = { total: a.questions.length, correct: 0, incorrect: 0, skipped: 0, percent: 0, topics: [] };
        for (const q of a.questions) {
          let topic = result.topics.find(t => t.topic === q.topic); if (!topic) { topic = { topic: q.topic, total: 0, correct: 0, incorrect: 0, skipped: 0 }; result.topics.push(topic); }
          const outcome = a.answers[q.id] === undefined ? 'skipped' : a.answers[q.id] === q.answer ? 'correct' : 'incorrect'; result[outcome]++; topic[outcome]++; topic.total++;
        }
        result.percent = Math.round(result.correct / result.total * 100);
        a.result = result; a.status = 'submitted'; a.submittedAt = stamp(); a.expired = !!a.expiresAt && now().getTime() >= Date.parse(a.expiresAt);
        const elapsed = Math.max(0, Math.round((now().getTime() - Date.parse(a.startedAt)) / 1000)); a.timeUsedSeconds = a.expiresAt ? Math.min(a.minutes * 60, elapsed) : elapsed;
        if (a.itemId) { const j = findJourney(d, a.journeyId); finishItem(d, j, findItem(j, a.itemId), { source: 'quiz', eventId: a.id, note: result.correct + '/' + result.total + ' correct; ' + result.skipped + ' skipped.' }); }
        return { attempt: clone(a) };
      }),
      abandonQuiz: attemptId => transact(s => { const a = data(s).attempts.find(a => a.id === attemptId); if (!a || a.status !== 'in-progress') throw Error('Attempt not open.'); editable(findJourney(data(s), a.journeyId)); a.status = 'abandoned'; a.endedAt = stamp(); }),
      getActivityYear(year, journeyId) {
        const account = user(), timezone = account?.timezone || 'Asia/Kolkata';
        const currentInstant = now();
        const currentDate = dateAt(currentInstant, timezone), currentYear = Number(currentDate.slice(0, 4));
        const selectedYear = year === undefined ? currentYear : Number(year);
        if (!Number.isInteger(selectedYear) || selectedYear < 1000 || selectedYear > 9999) throw RangeError('Choose a whole calendar year between 1000 and 9999.');
        const startDate = selectedYear + '-01-01', endDate = selectedYear + '-12-31';
        const size = (Date.parse(endDate + 'T12:00:00Z') - Date.parse(startDate + 'T12:00:00Z')) / 86400000 + 1;
        const days = Array.from({ length: size }, (_, index) => {
          const date = plusDays(startDate, index);
          return { date, count: 0, minutes: 0, plannedMinutes: 0, level: 0, future: date > currentDate };
        });
        const byDate = new Map(days.map(day => [day.date, day]));
        const d = account ? data() : null;
        const j = d?.journeys.find(journey => journey.id === (journeyId || d.selectedJourneyId) && journey.ownerId === account.id);
        const years = new Set([currentYear]);
        const seen = new Set(), creditedMinutes = new Map();
        const instant = value => { const result = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(result) && result <= currentInstant.getTime() ? result : null; };
        const record = (key, completedAt, amount) => {
          const timestamp = instant(completedAt);
          if (timestamp === null || seen.has(key)) return false;
          seen.add(key);
          const date = dateAt(new Date(timestamp), timezone);
          years.add(Number(date.slice(0, 4)));
          const day = byDate.get(date);
          if (day) { day.count++; day.minutes += amount; }
          return true;
        };
        let excludedSampleEvents = 0, unresolvedPlannedMinutes = 0;
        if (j) {
          const items = new Map(j.items.map(item => [item.id, item]));
          const tasks = new Map(j.tasks.map(task => [task.id, task]));
          const evidence = d.evidence.filter(e => e.ownerId === account.id && e.journeyId === j.id);
          excludedSampleEvents = evidence.filter(e => e.sample || e.source === 'sample').length;
          const active = evidence.filter(e => !e.correctedAt && !e.sample && e.source !== 'sample' && instant(e.completedAt) !== null);
          // Process the entire history before selecting a year: a January completion must not credit a slice already completed in December.
          active.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
          for (const e of active) {
            const item = items.get(e.itemId), task = e.taskId ? tasks.get(e.taskId) : null;
            if (!item || item.type === 'quiz' || e.source === 'quiz' || (e.taskId ? !task?.completedAt || task.itemId !== item.id : !item.completedAt)) continue;
            const key = e.eventId ? 'source:' + e.source + ':' + e.eventId : e.taskId ? 'task:' + e.taskId : 'item:' + item.id;
            const remaining = Math.max(0, item.duration - (creditedMinutes.get(item.id) || 0));
            const amount = Math.min(remaining, task ? task.minutes : item.duration);
            if (amount > 0 && record(key, e.completedAt, amount)) creditedMinutes.set(item.id, (creditedMinutes.get(item.id) || 0) + amount);
          }
          for (const attempt of d.attempts) {
            if (attempt.ownerId !== account.id || attempt.journeyId !== j.id || attempt.status !== 'submitted' || attempt.correctedAt || attempt.sample) continue;
            const item = items.get(attempt.itemId);
            const completion = item?.completedAt && active.find(e => e.itemId === item.id && e.source === 'quiz' && e.eventId === attempt.id);
            const amount = completion ? Math.max(0, item.duration - (creditedMinutes.get(item.id) || 0)) : 0;
            if (record('quiz:' + attempt.id, attempt.submittedAt, amount) && amount) creditedMinutes.set(item.id, item.duration);
          }
          const zoneFormatters = new Map();
          function plannedDate(task) {
            const zone = task.timezone || j.availability.timezone;
            if (zone === timezone) return task.date;
            if (!validTime(task.startTime)) return null;
            // Native Intl supplies actual timezone offsets, including DST. A repeated hour uses its first occurrence; nonexistent local times are reported separately.
            let formatter = zoneFormatters.get(zone);
            if (!formatter) { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); zoneFormatters.set(zone, formatter); }
            const wall = timestamp => {
              const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
              return Date.parse(parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second + 'Z');
            };
            const requested = Date.parse(task.date + 'T' + task.startTime + ':00Z');
            const candidates = [-86400000, 0, 86400000].map(delta => requested - (wall(requested + delta) - requested - delta)).filter(candidate => wall(candidate) === requested);
            return candidates.length ? dateAt(new Date(Math.min(...candidates)), timezone) : null;
          }
          const seenTasks = new Set();
          for (const task of j.tasks) {
            if (task.cancelledAt || seenTasks.has(task.id) || !items.has(task.itemId) || !validDate(task.date) || !Number.isFinite(task.minutes) || task.minutes <= 0) continue;
            seenTasks.add(task.id);
            const date = plannedDate(task);
            if (!date) { if (task.date.startsWith(String(selectedYear) + '-')) unresolvedPlannedMinutes += task.minutes; continue; }
            const day = byDate.get(date);
            if (day) day.plannedMinutes += task.minutes;
          }
        }
        for (const day of days) day.level = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count < 4 ? 2 : day.count < 6 ? 3 : 4;
        return {
          year: selectedYear, journeyId: j?.id || null, timezone, today: currentDate, startDate, endDate, days,
          activeDays: days.filter(day => day.count > 0).length, totalEvents: days.reduce((sum, day) => sum + day.count, 0),
          totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0), totalPlannedMinutes: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
          availableYears: [...years].sort((a, b) => b - a), intensityThresholds: [0, 1, 2, 4, 6], minutesKind: 'estimated-workload', countUnit: 'saved learning events',
          excludedSampleEvents, unresolvedPlannedMinutes,
          warnings: unresolvedPlannedMinutes ? ['Some planned times do not exist in their saved timezone because of a daylight-saving transition; those allocations are excluded from the comparison.'] : [],
          plannedDateBasis: 'Scheduled start date in the account timezone. Completed workload is dated by its saved learning event; optional practice quizzes add activity without invented workload minutes.'
        };
      },
      getStats(journeyId) {
        const j = api.getJourney(journeyId); if (!j) return { total: 0, completed: 0, percent: 0, plannedMinutes: 0, completedMinutes: 0, evidenceCount: 0, attempts: 0, averageScore: null, topics: [], activity: [], learningMix: [] };
        j.items = j.items.filter(i => !i.cancelledAt); j.tasks = j.tasks.filter(t => !t.cancelledAt);
        const evidence = api.getEvidence(j.id).filter(e => !e.correctedAt), attempts = api.getAttempts(j.id).filter(a => a.status === 'submitted'), completed = j.items.filter(i => i.completedAt).length;
        const topics = [...new Set(j.items.map(i => i.topic))].map(topic => { const items = j.items.filter(i => i.topic === topic); return { topic, total: items.length, completed: items.filter(i => i.completedAt).length }; });
        const activity = [...new Set(evidence.map(e => dateAt(new Date(e.completedAt), user().timezone)))].sort().map(date => ({ date, count: evidence.filter(e => dateAt(new Date(e.completedAt), user().timezone) === date).length }));
        const learningMix = ['lesson', 'problem', 'quiz', 'review'].map(type => ({ type, minutes: j.tasks.filter(t => t.completedAt && j.items.find(i => i.id === t.itemId)?.type === type).reduce((n, t) => n + t.minutes, 0), completed: j.items.filter(i => i.type === type && i.completedAt).length }));
        const correct = attempts.reduce((n, a) => n + a.result.correct, 0), answeredTotal = attempts.reduce((n, a) => n + a.result.total, 0);
        return { total: j.items.length, completed, percent: j.items.length ? Math.round(completed / j.items.length * 100) : 0, plannedMinutes: j.tasks.reduce((n, t) => n + t.minutes, 0), completedMinutes: j.tasks.filter(t => t.completedAt).reduce((n, t) => n + t.minutes, 0), evidenceCount: evidence.length, attempts: attempts.length, averageScore: answeredTotal ? Math.round(correct / answeredTotal * 100) : null, topics, activity, learningMix, weighting: 'Every included item has equal weight; time values are planned estimates, not measured focus time.' };
      }
    };
    return api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore, CATALOGUE, DEFAULT_AVAILABILITY, allocate, plusDays, PASSWORD_ITERATIONS };
  if (typeof window !== 'undefined') window.LearnioDomain = { createStore };
})(typeof window !== 'undefined' ? window : globalThis);
