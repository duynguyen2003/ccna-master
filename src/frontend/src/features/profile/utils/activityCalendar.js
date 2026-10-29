const DAY = 86400000;
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const parseDay = (date) => Date.parse(`${date}T00:00:00Z`);
export const shiftDay = (date, offset) =>
  new Date(parseDay(date) + offset * DAY).toISOString().slice(0, 10);

export function calendarDays(data) {
  const values = new Map(data.days.map((day) => [day.date, day]));
  const from = parseDay(data.from);
  const to = parseDay(data.to);
  const offset = (new Date(from).getUTCDay() + 6) % 7;
  const length = Math.round((to - from) / DAY) + 1;
  return Array.from({ length: Math.ceil((length + offset) / 7) * 7 }, (_, index) => {
    const date = new Date(from + (index - offset) * DAY).toISOString().slice(0, 10);
    const outside = date < data.from || date > data.to;
    return {
      date,
      outside,
      count: data.historyCompleteness === 'complete' ? 0 : null,
      lesson: 0,
      lab: 0,
      ...(!outside ? values.get(date) : {}),
    };
  });
}

export function intensity(count, levels) {
  if (count === null) return 'unknown';
  let level = 0;
  levels.forEach((threshold, index) => {
    if (count >= threshold) level = index;
  });
  return level;
}

export function describeDay(day) {
  const label = dateFormatter.format(new Date(`${day.date}T00:00:00Z`));
  if (day.count === null) return `${label}: chưa ghi nhận lượt hoàn thành.`;
  if (!day.count) return `${label}: 0 lượt hoàn thành.`;
  return `${label}: ${day.count} lượt hoàn thành (${day.lesson} bài học, ${day.lab} lab).`;
}
