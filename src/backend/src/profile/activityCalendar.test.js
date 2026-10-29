const test = require('node:test');
const assert = require('node:assert/strict');
const { calendarRange, localDay } = require('./activityCalendar');
const now = new Date('2026-10-28T12:00:00Z');

test('rolling interval is exactly 365 Vietnamese calendar days across year boundaries', () => {
  const range = calendarRange({}, now);
  assert.equal(range.from, '2025-10-29');
  assert.equal(range.to, '2026-10-28');
  assert.equal(localDay(new Date('2026-10-28T16:59:59.999Z')), '2026-10-28');
  assert.equal(localDay(new Date('2026-10-28T17:00:00Z')), '2026-10-29');
});

test('full past leap year and current partial year have correct boundaries', () => {
  const leap = calendarRange({ range: 'year', year: '2024' }, now);
  assert.equal((Date.parse(leap.to) - Date.parse(leap.from)) / 86400000 + 1, 366);
  assert.equal(calendarRange({ range: 'year', year: '2026' }, now).to, '2026-10-28');
});

test('rejects ambiguous, future and unexpected filters before querying data', () => {
  for (const query of [
    { range: ['year'] },
    { type: ['lab'] },
    { type: 'exam' },
    { range: 'month' },
    { range: 'year' },
    { range: 'year', year: '2027' },
    { range: 'year', year: '1999' },
    { range: 'year', year: '2026 OR 1=1' },
    { range: 'year', year: '2026x' },
    { range: 'last365', year: '2026' },
    { userId: '2' },
  ])
    assert.throws(() => calendarRange(query, now), { status: 400 });
});
