// Nightly cleanup of photos that were uploaded but never saved on a dish or the logo (the
// editor uploads as soon as a crop is confirmed; leaving without saving strands the file).
// Replaced or removed photos are KEPT on purpose (owner's choice): their keys are queued in
// image_deletions by a trigger, and that queue counts as "in use" here.
// No Next.js or "server-only" imports: this runs from the Worker's scheduled() handler.
import { IMAGE_KEY_PATTERN } from "../images/webp";

/** Only files older than this are touched, so an editor that is still open never loses one. */
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** Safety cap per run; anything left over goes the next night. */
export const MAX_DELETES_PER_RUN = 500;

export type StoredObject = { key: string; uploaded: Date };

/** Keys to delete: valid image keys, not in use, old enough. */
export function pickUnsavedUploads(
  objects: StoredObject[],
  inUse: ReadonlySet<string>,
  now: Date,
): string[] {
  return objects
    .filter(
      (o) =>
        IMAGE_KEY_PATTERN.test(o.key) &&
        !inUse.has(o.key) &&
        now.getTime() - o.uploaded.getTime() >= MIN_AGE_MS,
    )
    .map((o) => o.key)
    .slice(0, MAX_DELETES_PER_RUN);
}

const SOURCES = [
  // [table, primary key (stable paging order), image columns]
  ["items", "id", ["icon_key", "hero_key"]],
  ["categories", "id", ["icon_key"]],
  ["restaurants", "id", ["logo_key"]],
  ["image_deletions", "key", ["key"]], // replaced/removed photos: kept
] as const;
const PAGE = 1000;

/** Every key the database still points at (or keeps). Throws on any error: never guess. */
export async function fetchKeysInUse(
  supabaseUrl: string,
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const [table, pk, columns] of SOURCES) {
    for (let offset = 0; ; offset += PAGE) {
      const url = new URL(`/rest/v1/${table}`, supabaseUrl);
      url.searchParams.set("select", columns.join(","));
      url.searchParams.set("order", pk);
      url.searchParams.set("limit", String(PAGE));
      url.searchParams.set("offset", String(offset));
      const res = await fetchImpl(url, {
        headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
      });
      if (!res.ok)
        throw new Error(`${table}: ${res.status} ${await res.text()}`);
      const rows = (await res.json()) as Record<string, string | null>[];
      for (const row of rows)
        for (const c of columns) if (row[c]) keys.add(row[c]);
      if (rows.length < PAGE) break;
    }
  }
  return keys;
}

type Bucket = {
  list(o: { cursor?: string; limit?: number }): Promise<{
    objects: StoredObject[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string[]): Promise<void>;
};

export async function deleteUnsavedUploads(opts: {
  bucket: Bucket;
  supabaseUrl: string;
  secretKey: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}) {
  const inUse = await fetchKeysInUse(
    opts.supabaseUrl,
    opts.secretKey,
    opts.fetchImpl,
  );
  const objects: StoredObject[] = [];
  let cursor: string | undefined;
  do {
    const page = await opts.bucket.list({ cursor, limit: 1000 });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  // Sanity check: images exist but the database claims none are used → something is wrong.
  if (inUse.size === 0 && objects.length > 0)
    throw new Error("no keys in use reported; refusing to delete");
  const doomed = pickUnsavedUploads(objects, inUse, opts.now ?? new Date());
  if (doomed.length) await opts.bucket.delete(doomed);
  return { scanned: objects.length, inUse: inUse.size, deleted: doomed };
}
