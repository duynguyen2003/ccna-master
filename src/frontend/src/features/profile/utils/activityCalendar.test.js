import { calendarDays, describeDay, intensity } from './activityCalendar';

test('lays out complete Monday-first weeks, including leap day and noninteractive padding', () => {
  const days = calendarDays({
    from: '2024-02-28',
    to: '2024-03-01',
    days: [],
    historyCompleteness: 'unknown',
  });
  expect(days).toHaveLength(7);
  expect(days.filter((day) => !day.outside).map((day) => day.date)).toEqual([
    '2024-02-28',
    '2024-02-29',
    '2024-03-01',
  ]);
  expect(days[0]).toMatchObject({ date: '2024-02-26', outside: true });
  expect(days[2].count).toBeNull();
  expect(describeDay(days[2])).toContain('chưa ghi nhận');
});

test('distinguishes recorded zero, missing history and fixed intensity thresholds', () => {
  const input = {
    from: '2026-10-27',
    to: '2026-10-28',
    historyCompleteness: 'complete',
    days: [{ date: '2026-10-28', count: 3, lesson: 2, lab: 1 }],
  };
  const days = calendarDays(input).filter((day) => !day.outside);
  expect(days[0].count).toBe(0);
  expect(describeDay(days[1])).toContain('3 lượt hoàn thành (2 bài học, 1 lab)');
  expect([null, 0, 1, 2, 3, 7, 8].map((value) => intensity(value, [0, 1, 3, 5, 8]))).toEqual([
    'unknown',
    0,
    1,
    1,
    2,
    3,
    4,
  ]);
});
