'use strict';
(function (root) {
  const DAY = 86400000;
  const dateKey = time => new Date(time).toISOString().slice(0, 10);
  const stamp = date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return NaN;
    const value = Date.parse(date + 'T12:00:00Z');
    return Number.isFinite(value) && dateKey(value) === date ? value : NaN;
  };
  const monday = time => time - (new Date(time).getUTCDay() + 6) % 7 * DAY;
  const taskMinutes = task => Number.isFinite(task.minutes) && task.minutes > 0 ? task.minutes : 0;

  function buildWeeks(tasks, today, startDate) {
    const current = stamp(today);
    if (!Number.isFinite(current)) throw new RangeError('Choose a valid current date.');
    const dated = tasks.filter(task => Number.isFinite(stamp(task.date)));
    const dates = dated.map(task => stamp(task.date));
    if (Number.isFinite(stamp(startDate))) dates.push(stamp(startDate));
    const first = monday(dates.length ? dates.reduce((min, value) => Math.min(min, value)) : current);
    const last = monday(dates.reduce((max, value) => Math.max(max, value), current));
    const weeks = [];
    for (let time = first; time <= last; time += 7 * DAY) {
      const start = dateKey(time);
      weeks.push({ key: start, startDate: start, endDate: dateKey(time + 6 * DAY), tasks: [], completed: 0, minutes: 0 });
    }
    for (const task of dated) {
      const week = weeks[Math.floor((stamp(task.date) - first) / (7 * DAY))];
      week.tasks.push(task);
      week.completed += task.completedAt ? 1 : 0;
      week.minutes += taskMinutes(task);
    }
    for (const week of weeks) week.tasks.sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    return weeks;
  }

  function currentWeekIndex(weeks, today) {
    if (!Number.isFinite(stamp(today))) throw new RangeError('Choose a valid current date.');
    if (!weeks.length) return -1;
    const index = weeks.findIndex(week => week.endDate >= today);
    return index === -1 ? weeks.length - 1 : index;
  }

  function groupWeek(tasks, journey, catalogue = []) {
    const sources = new Map();
    for (const ref of journey.contentReferences || []) {
      const entry = catalogue.find(value => value.id === ref.id && value.version === ref.version);
      if (!entry || !['course', 'sheet'].includes(entry.type)) continue;
      for (const item of entry.items || []) {
        if (!sources.has(item.sourceId)) sources.set(item.sourceId, { key: ref.id + ':' + ref.version, type: entry.type, title: ref.title || entry.title });
      }
    }
    const fallback = {
      lesson: { type: 'course', title: 'Course lessons' },
      problem: { type: 'sheet', title: 'Practice sheet' },
      quiz: { type: 'quiz', title: 'Quizzes' },
      review: { type: 'review', title: 'Review' }
    };
    const groups = new Map();
    for (const task of tasks) {
      const item = task.item || journey.items?.find(value => value.id === task.itemId);
      const source = sources.get(item?.sourceId);
      const info = source || { key: 'type:' + (task.type || item?.type || 'other'), ...(fallback[task.type || item?.type] || { type: 'other', title: 'Learning items' }) };
      if (!groups.has(info.key)) groups.set(info.key, { ...info, tasks: [], completed: 0, minutes: 0 });
      const group = groups.get(info.key);
      group.tasks.push(task);
      group.completed += task.completedAt ? 1 : 0;
      group.minutes += taskMinutes(task);
    }
    return [...groups.values()];
  }

  const api = { buildWeeks, currentWeekIndex, groupWeek };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LearnioPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
