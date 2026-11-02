/*
 * Days, months and years as the team means them: in Estonian time. A gift
 * made at 01:00 on the 1st in Tallinn is still the previous day in UTC, and
 * would count towards the wrong month if periods began at UTC midnight.
 */

const TIME_ZONE = "Europe/Tallinn";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The date and time an instant is in Estonia, as numbers; month from 0. */
function wallClock(instant: Date) {
  const formatted = parts.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatted.find((p) => p.type === type)?.value);
  return {
    year: value("year"),
    month: value("month") - 1,
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** The date an instant falls on in Estonia; month from 0. */
export function estonianDate(instant: Date) {
  const { year, month, day } = wallClock(instant);
  return { year, month, day };
}

/**
 * The instant a day starts in Estonia. Month and day may be out of range,
 * as with Date.UTC: month 12 is next January, day 0 the month's last day.
 */
export function estonianMidnight(year: number, month: number, day = 1): Date {
  const asIfUtc = Date.UTC(year, month, day);
  // Estonia is two or three hours ahead, and the clocks change at 03:00 or
  // 04:00, never near midnight, so the offset at UTC midnight is the
  // offset at the Estonian one too.
  const clock = wallClock(new Date(asIfUtc));
  const offset =
    Date.UTC(
      clock.year,
      clock.month,
      clock.day,
      clock.hour,
      clock.minute,
      clock.second,
    ) - asIfUtc;
  return new Date(asIfUtc - offset);
}

/**
 * The instants an Estonian day, written "2026-06-30", starts and ends at:
 * [start, end). Null when it isn't a date written so.
 */
export function estonianDay(isoDate: string): [Date, Date] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ];
  return [
    estonianMidnight(year, month, day),
    estonianMidnight(year, month, day + 1),
  ];
}

/** "2026-06-01": a date written as the admin panel reads it. */
export function isoDate(year: number, month: number, day = 1): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
