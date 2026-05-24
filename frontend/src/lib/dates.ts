export function getCurrentWeekRangeLabel(referenceDate = new Date()) {
  const { start, end } = getCurrentWeekBounds(referenceDate);

  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });

  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatMonthDayYear(start)}-${formatMonthDayYear(end)}`;
  }

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()}-${endMonth} ${end.getDate()}`;
}

export function getCurrentWeekBounds(referenceDate = new Date()) {
  const start = getWeekStart(referenceDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start,
    end,
    startIso: toIsoDate(start),
    endIso: toIsoDate(end),
  };
}

function getWeekStart(referenceDate: Date) {
  const localDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
  );
  const mondayOffset = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - mondayOffset);
  return localDate;
}

function formatMonthDayYear(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toIsoDate(date: Date) {
  return date.toLocaleDateString("en-CA");
}
