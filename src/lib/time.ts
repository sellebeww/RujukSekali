// All instants are UTC epoch milliseconds. Indonesia's WIB is a fixed UTC+7 with no DST,
// so local-time conversion is plain arithmetic.
export const WIB_OFFSET_MIN = 7 * 60;
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** "YYYY-MM-DD" in WIB for an instant. */
export function toLocalDate(ms: number): string {
  return new Date(ms + WIB_OFFSET_MIN * MINUTE).toISOString().slice(0, 10);
}

/** Minutes after local (WIB) midnight. */
export function localMinuteOfDay(ms: number): number {
  const local = (ms + WIB_OFFSET_MIN * MINUTE) % DAY;
  return Math.floor((local < 0 ? local + DAY : local) / MINUTE);
}

/** "HH:MM" -> minutes after midnight. */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m))
    throw new Error(`Bad time ${hhmm}`);
  return h * 60 + m;
}

export function minToHhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local WIB date + "HH:MM" -> UTC epoch ms. */
export function localToUtc(localDate: string, hhmm: string): number {
  return Date.parse(`${localDate}T00:00:00Z`) + (hhmmToMin(hhmm) - WIB_OFFSET_MIN) * MINUTE;
}

export function addDays(localDate: string, n: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(localDate: string): number {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "Senin, 3 Nov" */
export function formatLocalDate(localDate: string): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "07:30" in WIB */
export function formatLocalTime(ms: number): string {
  return minToHhmm(localMinuteOfDay(ms));
}

export function formatIdr(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

/** Deterministic clock for tests and simulation. */
export class FakeClock implements Clock {
  constructor(private t: number) {}
  now() {
    return this.t;
  }
  set(t: number) {
    this.t = t;
  }
  advance(ms: number) {
    this.t += ms;
  }
}

/** "Senin, 3 Nov 07:30" in WIB. */
export function formatLocalDateTime(ms: number): string {
  return `${formatLocalDate(toLocalDate(ms))} ${formatLocalTime(ms)}`;
}
