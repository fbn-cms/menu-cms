import { describe, expect, test } from "vitest";
import { computeUntil, zonedTimeToUtc } from "./until";

const TZ = "America/Toronto";
const hours = {
  fri: [["17:00", "23:00"]],
  sat: [
    ["12:00", "15:00"],
    ["17:00", "01:00"],
  ],
} as const;
// Helper: a Toronto wall-clock instant.
const at = (iso: string) => {
  const [d, t] = iso.split("T") as [string, string];
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const [hh, mm] = t.split(":").map(Number) as [number, number];
  return zonedTimeToUtc(y, m, day, hh, mm, TZ);
};

describe("zonedTimeToUtc", () => {
  test("EDT (UTC-4) in October", () => {
    expect(at("2026-10-16T20:00").toISOString()).toBe(
      "2026-10-17T00:00:00.000Z",
    );
  });
  test("EST (UTC-5) in January", () => {
    expect(at("2026-01-16T20:00").toISOString()).toBe(
      "2026-01-17T01:00:00.000Z",
    );
  });
});

describe("computeUntil", () => {
  test("manual never expires", () => {
    expect(
      computeUntil("manual", at("2026-10-16T20:00"), TZ, hours),
    ).toBeNull();
  });
  test("tonight = next 07:00 local", () => {
    expect(computeUntil("tonight", at("2026-10-16T20:00"), TZ, hours)).toEqual(
      at("2026-10-17T07:00"),
    );
  });
  test("tonight after midnight but before 7am = 07:00 the same morning", () => {
    expect(computeUntil("tonight", at("2026-10-17T01:30"), TZ, hours)).toEqual(
      at("2026-10-17T07:00"),
    );
  });
  test("rest of service = today's closing time", () => {
    expect(computeUntil("service", at("2026-10-16T19:00"), TZ, hours)).toEqual(
      at("2026-10-16T23:00"),
    );
  });
  test("rest of service handles a close after midnight", () => {
    expect(computeUntil("service", at("2026-10-17T20:00"), TZ, hours)).toEqual(
      at("2026-10-18T01:00"),
    );
  });
  test("rest of service after closing falls back to tonight", () => {
    expect(computeUntil("service", at("2026-10-16T23:30"), TZ, hours)).toEqual(
      at("2026-10-17T07:00"),
    );
  });
  test("rest of service on a day with no hours falls back to tonight", () => {
    expect(computeUntil("service", at("2026-10-14T12:00"), TZ, hours)).toEqual(
      at("2026-10-15T07:00"),
    );
  });
  test("DST change night: tonight still lands on 07:00 local", () => {
    // 2026-11-01 02:00 EDT → 01:00 EST
    expect(computeUntil("tonight", at("2026-10-31T22:00"), TZ, hours)).toEqual(
      at("2026-11-01T07:00"),
    );
    expect(at("2026-11-01T07:00").toISOString()).toBe(
      "2026-11-01T12:00:00.000Z",
    );
  });
});
