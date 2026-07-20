interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(date: Date, timeZone: string): LocalParts {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as unknown as LocalParts;
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour);
  let result = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = localParts(new Date(result), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    result -= represented - target;
  }
  return new Date(result);
}

export function businessDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const parts = localParts(now, timeZone);
  const start = localDateTimeToUtc(parts.year, parts.month, parts.day, 0, timeZone);
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const end = localDateTimeToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    0,
    timeZone,
  );
  return { start, end };
}
