'use strict';
(function (root) {
  const DAY = 86400000;
  const stamp = date => Date.parse(`${date}T00:00:00Z`);
  const dateKey = time => new Date(time).toISOString().slice(0, 10);

  function donutSegments(values) {
    if (values.some(value => !Number.isFinite(value) || value < 0)) throw new RangeError('Chart values must be nonnegative numbers.');
    const total = values.reduce((sum, value) => sum + value, 0);
    let offset = 0;
    return values.map(value => {
      const share = total ? value / total * 100 : 0;
      const segment = { value, share, offset };
      offset += share;
      return segment;
    });
  }

  function weeklySeries(days, asOf, count = 8) {
    const end = stamp(asOf);
    if (!Number.isFinite(end) || !Number.isInteger(count) || count < 1 || count > 53) throw new RangeError('Choose a valid date and week count.');
    const start = end - new Date(end).getUTCDay() * DAY - (count - 1) * 7 * DAY;
    const weeks = Array.from({ length: count }, (_, index) => ({ start: dateKey(start + index * 7 * DAY), end: dateKey(start + (index * 7 + 6) * DAY), planned: 0, completed: 0 }));
    for (const day of days) {
      const index = Math.floor((stamp(day.date) - start) / (7 * DAY));
      if (index < 0 || index >= weeks.length || !Number.isFinite(index)) continue;
      weeks[index].planned += day.plannedMinutes || 0;
      weeks[index].completed += day.minutes || 0;
    }
    return weeks;
  }

  function quizOutcomes(attempts) {
    const result = { correct: 0, incorrect: 0, skipped: 0 };
    for (const attempt of attempts) {
      if (attempt.status !== 'submitted' || !attempt.result) continue;
      for (const outcome of Object.keys(result)) result[outcome] += attempt.result[outcome];
    }
    result.total = result.correct + result.incorrect + result.skipped;
    result.percent = result.total ? Math.round(result.correct / result.total * 100) : null;
    return result;
  }

  const api = { donutSegments, weeklySeries, quizOutcomes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LearnioCharts = api;
})(typeof window !== 'undefined' ? window : globalThis);
