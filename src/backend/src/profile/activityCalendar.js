const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY = 86400000;
const LEVELS = [0, 1, 3, 5, 8];

function invalidFilter() {
  return Object.assign(new Error('Bộ lọc lịch hoạt động không hợp lệ.'), { status: 400 });
}

function localDay(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function calendarRange(query = {}, now = new Date()) {
  if (Object.keys(query).some((key) => !['range', 'type', 'year'].includes(key)))
    throw invalidFilter();
  const range = query.range ?? 'last365';
  const type = query.type ?? 'all';
  if (!['last365', 'year'].includes(range) || !['all', 'lesson', 'lab'].includes(type))
    throw invalidFilter();
  const today = localDay(now);
  const currentYear = Number(today.slice(0, 4));
  if (range === 'last365' && query.year !== undefined) throw invalidFilter();
  if (
    range === 'year' &&
    (typeof query.year !== 'string' ||
      !/^\d{4}$/.test(query.year) ||
      Number(query.year) < 2000 ||
      Number(query.year) > currentYear)
  )
    throw invalidFilter();
  const year = range === 'year' ? Number(query.year) : null;
  const from = year
    ? `${year}-01-01`
    : new Date(Date.parse(`${today}T00:00:00Z`) - 364 * DAY).toISOString().slice(0, 10);
  const to = year && year < currentYear ? `${year}-12-31` : today;
  return { range, type, year, from, to, today, currentYear };
}

async function getActivityCalendar(prisma, userId, query, now = new Date()) {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'), { status: 401 });
  const period = calendarRange(query, now);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) throw Object.assign(new Error('Không tìm thấy tài khoản.'), { status: 404 });
  const start = new Date(`${period.from}T00:00:00+07:00`).toISOString();
  const end = new Date(Date.parse(`${period.to}T00:00:00+07:00`) + DAY).toISOString();
  const eventType = period.type === 'lesson' ? 'LESSON_COMPLETED' : 'LAB_COMPLETED';

  // Deduplicate over the user's history BEFORE filtering the display interval:
  // an old completion followed by a duplicate this year must not count again.
  // Prisma DateTime is stored as UTC timestamp without time zone in this schema.
  const rows = await prisma.$queryRaw`
    WITH first_completions AS (
      SELECT type, reference_id, MIN(created_at) AS happened_at
      FROM user_activity
      WHERE user_id = ${userId}
        AND type IN ('LESSON_COMPLETED', 'LAB_COMPLETED') AND reference_id > 0
      GROUP BY type, reference_id
    )
    SELECT (happened_at AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})::date::text AS date,
      (COUNT(*) FILTER (WHERE type = 'LESSON_COMPLETED'))::int AS lesson,
      (COUNT(*) FILTER (WHERE type = 'LAB_COMPLETED'))::int AS lab
    FROM first_completions
    WHERE happened_at >= ${start}::timestamp AND happened_at < ${end}::timestamp
      AND happened_at <= ${now.toISOString()}::timestamp
      AND (${period.type} = 'all' OR type = ${eventType})
    GROUP BY 1 ORDER BY 1
  `;
  const days = rows.map(({ date, lesson, lab }) => ({ date, lesson, lab, count: lesson + lab }));
  const firstYear = Math.max(
    2000,
    Math.min(period.currentYear, Number(localDay(user.createdAt).slice(0, 4)))
  );
  return {
    metric: 'completion_count',
    timeZone: TIME_ZONE,
    range: period.range,
    type: period.type,
    from: period.from,
    to: period.to,
    today: period.today,
    total: days.reduce((sum, day) => sum + day.count, 0),
    activeDays: days.length,
    levels: LEVELS,
    // Existing logs do not prove that all historical days were tracked.
    historyCompleteness: 'unknown',
    availableYears: Array.from(
      { length: period.currentYear - firstYear + 1 },
      (_, i) => period.currentYear - i
    ),
    days,
  };
}

module.exports = { calendarRange, getActivityCalendar, localDay };
