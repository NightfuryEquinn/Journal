/** Zero-pad a number to two digits. */
export const pad = (n: number) => String(n).padStart(2, '0');

/** Format time as HH:MM:SS. */
export function fmtTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format date as DD MON YYYY. */
export function fmtDate(d: Date) {
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${pad(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()}`;
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
