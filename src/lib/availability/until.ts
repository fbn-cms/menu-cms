// "Sold out until…" presets for the 86 board, computed in the restaurant's timezone.
//   service → end of today's service (last closing time in hours_json), else falls back to tonight
//   tonight → next 04:00 local (the daily reset time)
//   manual  → no expiry ("until I change it")

export type UntilPreset = "service" | "tonight" | "manual";
export const RESET_HOUR = 4;

type Hours = Partial<
  Record<
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
    [string, string][]
  >
>;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Wall-clock parts of `date` in `timeZone`. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday")
      .toLowerCase()
      .slice(0, 3) as (typeof DAY_KEYS)[number],
  };
}

/** Offset (ms) of `timeZone` from UTC at instant `date`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000
  );
}

/** The UTC instant for a local wall-clock time in `timeZone` (DST-safe for non-gap times). */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function nextReset(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone);
  const day =
    p.hour < RESET_HOUR
      ? { y: p.year, m: p.month, d: p.day }
      : addDays(p.year, p.month, p.day, 1);
  return zonedTimeToUtc(day.y, day.m, day.d, RESET_HOUR, 0, timeZone);
}

function endOfService(now: Date, timeZone: string, hours: Hours): Date | null {
  const p = zonedParts(now, timeZone);
  // Before the reset hour we're still in "yesterday's" service day.
  const serviceDay =
    p.hour < RESET_HOUR
      ? addDays(p.year, p.month, p.day, -1)
      : { y: p.year, m: p.month, d: p.day };
  const weekday =
    DAY_KEYS[
      new Date(
        Date.UTC(serviceDay.y, serviceDay.m - 1, serviceDay.d),
      ).getUTCDay()
    ]!;
  const ranges = hours[weekday] ?? [];
  let latest: Date | null = null;
  for (const [open, close] of ranges) {
    const [oh = 0, om = 0] = open.split(":").map(Number);
    const [ch = 0, cm = 0] = close.split(":").map(Number);
    // A closing time at/before opening (e.g. 17:00–01:00) is after midnight.
    const closeDay =
      ch * 60 + cm <= oh * 60 + om
        ? addDays(serviceDay.y, serviceDay.m, serviceDay.d, 1)
        : serviceDay;
    const closeAt = zonedTimeToUtc(
      closeDay.y,
      closeDay.m,
      closeDay.d,
      ch,
      cm,
      timeZone,
    );
    if (!latest || closeAt > latest) latest = closeAt;
  }
  return latest && latest > now ? latest : null;
}

export function computeUntil(
  preset: UntilPreset,
  now: Date,
  timeZone: string,
  hours: unknown,
): Date | null {
  if (preset === "manual") return null;
  if (preset === "service") {
    const end = endOfService(now, timeZone, (hours ?? {}) as Hours);
    if (end) return end;
  }
  return nextReset(now, timeZone);
}
