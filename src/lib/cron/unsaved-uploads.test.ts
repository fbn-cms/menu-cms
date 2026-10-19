import { describe, expect, test, vi } from "vitest";
import {
  deleteUnsavedUploads,
  fetchKeysInUse,
  MAX_DELETES_PER_RUN,
  pickUnsavedUploads,
  type StoredObject,
} from "./unsaved-uploads";

const RID = "00000000-0000-4000-8000-000000000001";
const ITEM = "00000000-0000-4000-8000-0000000000e1";
const key = (kind: string, n: number) =>
  `${RID}/${ITEM}/${kind}-${n.toString(16).padStart(24, "0")}.webp`;
const NOW = new Date("2026-10-20T07:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("pickUnsavedUploads", () => {
  test("deletes only old, unused image keys", () => {
    const objects: StoredObject[] = [
      { key: key("hero", 1), uploaded: daysAgo(3) }, // on a dish
      { key: key("hero", 2), uploaded: daysAgo(3) }, // replaced → kept
      { key: key("hero", 3), uploaded: daysAgo(3) }, // never saved → delete
      { key: key("icon", 4), uploaded: daysAgo(0.5) }, // never saved but fresh
      { key: `${RID}/brand/logo-${"a".repeat(24)}.webp`, uploaded: daysAgo(2) },
      { key: "backups/db.sql.gz", uploaded: daysAgo(9) }, // not an image key
    ];
    const inUse = new Set([key("hero", 1), key("hero", 2)]);
    expect(pickUnsavedUploads(objects, inUse, NOW)).toEqual([
      key("hero", 3),
      `${RID}/brand/logo-${"a".repeat(24)}.webp`,
    ]);
  });

  test("caps deletions per run", () => {
    const objects = Array.from({ length: MAX_DELETES_PER_RUN + 5 }, (_, i) => ({
      key: key("icon", i + 1),
      uploaded: daysAgo(2),
    }));
    expect(pickUnsavedUploads(objects, new Set(), NOW)).toHaveLength(
      MAX_DELETES_PER_RUN,
    );
  });
});

const okJson = (rows: unknown) =>
  new Response(JSON.stringify(rows), { status: 200 });

describe("fetchKeysInUse", () => {
  test("collects keys from dishes, categories, logo and the kept queue", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const table = new URL(String(input)).pathname.split("/").pop();
      return okJson(
        {
          items: [
            { icon_key: "i1", hero_key: "h1" },
            { icon_key: null, hero_key: "h2" },
          ],
          categories: [{ icon_key: null }],
          restaurants: [{ logo_key: "logo" }],
          image_deletions: [{ key: "old" }],
        }[table!],
      );
    });
    const keys = await fetchKeysInUse(
      "http://db",
      "secret",
      fetchImpl as typeof fetch,
    );
    expect([...keys].sort()).toEqual(["h1", "h2", "i1", "logo", "old"]);
  });

  test("throws when the database can't be read", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(
      fetchKeysInUse("http://db", "secret", fetchImpl as typeof fetch),
    ).rejects.toThrow("500");
  });
});

describe("deleteUnsavedUploads", () => {
  test("refuses to delete when the database reports nothing in use", async () => {
    const bucket = {
      list: vi.fn(async () => ({
        objects: [{ key: key("hero", 1), uploaded: daysAgo(5) }],
        truncated: false,
      })),
      delete: vi.fn(async () => {}),
    };
    const fetchImpl = vi.fn(async () => okJson([]));
    await expect(
      deleteUnsavedUploads({
        bucket,
        supabaseUrl: "http://db",
        secretKey: "s",
        now: NOW,
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).rejects.toThrow("refusing");
    expect(bucket.delete).not.toHaveBeenCalled();
  });
});
