// Every event is in the Philippines, so dates are shown and entered in
// Manila time no matter where the server or the visitor is. Manila has no
// daylight saving, which keeps the offset fixed.
export const TIME_ZONE = "Asia/Manila";
const OFFSET = "+08:00";
const OFFSET_MS = 8 * 60 * 60 * 1000;

type DateInput = Date | string;
const toDate = (d: DateInput) => (typeof d === "string" ? new Date(d) : d);

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, ...options });

const weekdayDate = fmt({ weekday: "short", month: "short", day: "numeric" });
const fullDate = fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
const shortDate = fmt({ month: "short", day: "numeric" });
const time = fmt({ hour: "numeric", minute: "2-digit" });
const monthShort = fmt({ month: "short" });
const monthLong = fmt({ month: "long" });
const weekdayShort = fmt({ weekday: "short" });
const dayOfMonth = fmt({ day: "numeric" });

export const formatWeekdayDate = (d: DateInput) => weekdayDate.format(toDate(d));
export const formatFullDate = (d: DateInput) => fullDate.format(toDate(d));
export const formatShortDate = (d: DateInput) => shortDate.format(toDate(d));
export const formatTime = (d: DateInput) => time.format(toDate(d)).replace(/\s/g, " ");
export const formatMonth = (d: DateInput) => monthShort.format(toDate(d)).toUpperCase();
export const formatMonthName = (d: DateInput) => monthLong.format(toDate(d));
export const formatWeekday = (d: DateInput) => weekdayShort.format(toDate(d));
export const formatDay = (d: DateInput) => dayOfMonth.format(toDate(d));
export const formatDateTime = (d: DateInput) => `${formatShortDate(d)}, ${formatTime(d)}`;

export function formatTimeRange(start: DateInput, end: DateInput) {
  const s = toDate(start);
  const e = toDate(end);
  if (manilaDayKey(s) === manilaDayKey(e)) return `${formatTime(s)} to ${formatTime(e)}`;
  return `${formatTime(s)} to ${formatShortDate(e)}, ${formatTime(e)}`;
}

// "2026-10-18" for the Manila calendar day the instant falls on.
export function manilaDayKey(d: DateInput) {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

// Value for <input type="datetime-local">, in Manila time.
export function toLocalInput(d: DateInput) {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

// Reads a datetime-local value as Manila time.
export function fromLocalInput(value: string) {
  return new Date(`${value.length === 16 ? `${value}:00` : value}${OFFSET}`);
}

// Start of the Manila day that `d` falls on, plus `days`.
export function manilaStartOfDay(d: Date, days = 0) {
  return fromLocalInput(`${manilaDayKey(new Date(d.getTime() + days * 86_400_000))}T00:00`);
}

// 0 = Sunday, in Manila.
export function manilaWeekday(d: Date) {
  return new Date(d.getTime() + OFFSET_MS).getUTCDay();
}

// The countdown on an event page: "Starts in 3 hours", "Happening now".
export function startsIn(start: DateInput, end: DateInput, now = new Date()) {
  const s = toDate(start);
  if (now >= toDate(end)) return "Ended";
  if (now >= s) return "Happening now";
  const minutes = Math.ceil((s.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return `Starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 12 || manilaDayKey(s) === manilaDayKey(now)) return `Starts in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round((manilaStartOfDay(s).getTime() - manilaStartOfDay(now).getTime()) / 86_400_000);
  if (days === 1) return "Starts tomorrow";
  if (days < 14) return `Starts in ${days} days`;
  return `Starts in ${Math.floor(days / 7)} weeks`;
}

export function relativeDays(target: DateInput, now = new Date()) {
  const days = Math.round(
    (manilaStartOfDay(toDate(target)).getTime() - manilaStartOfDay(now).getTime()) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  return null;
}
