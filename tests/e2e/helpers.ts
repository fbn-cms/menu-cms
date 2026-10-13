import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

/** Run SQL against the local Supabase (local stack only). */
export const sql = (statement: string) =>
  execFileSync("docker", [
    "exec",
    "supabase_db_menu-cms",
    "psql",
    "-U",
    "postgres",
    "-tAc",
    statement,
  ])
    .toString()
    .trim();

export async function signIn(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("local-dev-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}

/** A real w×h PNG (solid colour), so the browser's decode → crop → WebP path is exercised. */
export function png(
  w: number,
  h: number,
  rgb: [number, number, number] = [154, 52, 18],
): Buffer {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: w }, () => [...rgb, 255]).flat()),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk(
      "IDAT",
      deflateSync(Buffer.concat(Array.from({ length: h }, () => row))),
    ),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
