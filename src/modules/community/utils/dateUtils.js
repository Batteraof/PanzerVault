function pad(value) {
  return String(value).padStart(2, '0');
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function weekKeyFromDate(date) {
  const start = startOfWeek(date);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

function startOfWeek(date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + diff);
  return value;
}

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function parseLocalDateTimeString(input) {
  const match = String(input || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

function parseDateTimeParts(input) {
  const match = String(input || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText)
  };
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function utcValueFromParts(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
}

function sameDateTimeParts(left, right) {
  return left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute;
}

function parseDateTimeInTimeZone(input, timeZone) {
  const parts = parseDateTimeParts(input);
  if (!parts) return null;

  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
  } catch {
    return null;
  }

  const targetUtcValue = utcValueFromParts(parts);
  let guess = new Date(targetUtcValue);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentParts = zonedParts(guess, timeZone);
    const offset = targetUtcValue - utcValueFromParts(currentParts);
    guess = new Date(guess.getTime() + offset);
  }

  return sameDateTimeParts(parts, zonedParts(guess, timeZone)) ? guess : null;
}

function monthsSince(startDate, endDate) {
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
  months += endDate.getMonth() - startDate.getMonth();

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1;
  }

  return months;
}

function anniversaryLabel(months) {
  if (months < 12) {
    return `${months} months`;
  }

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

module.exports = {
  monthKeyFromDate,
  weekKeyFromDate,
  startOfWeek,
  addDays,
  parseLocalDateTimeString,
  parseDateTimeInTimeZone,
  monthsSince,
  anniversaryLabel
};
