/** Three-letter month labels, January first. Shared by list and format. */
export const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/** Full month names, January first. Shared by the reader screen. */
export const MONTHS_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

/** Zero-pad a number to two digits. */
export const pad = (n: number) => String(n).padStart(2, '0');

/** Format time as HH:MM:SS. */
export function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format date as DD MON YYYY. */
export function fmtDate(d: Date) {
  return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format julian day of year. */
export function fmtJDay(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return String(Math.floor(diff / 86400000)).padStart(3, '0');
}

/** Format a log sequence number as a zero-padded 4-digit string. */
export function fmtSeq(n: number) {
  return String(n).padStart(4, '0');
}

/** Format as DDMMYYYY.HHmmss (24h). */
export function fmtStamp(d: Date) {
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** UTC offset label, e.g. "UTC+8" or "UTC-5:30". Derives from the device clock. */
export function fmtUtcOffset(d: Date) {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${pad(m)}` : ''}`;
}
