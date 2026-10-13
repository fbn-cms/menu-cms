import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";

const sql = (statement: string) =>
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

async function signIn(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("local-dev-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}

/** A real w×h PNG (solid colour) built in-process, so the browser's resize path is exercised. */
function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
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
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: w }, () => [154, 52, 18, 255]).flat()),
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

test.describe("appearance settings", () => {
  test.afterEach(() => {
    sql(
      "update restaurants set name='Demo Bistro', logo_key=null, theme_json='{}' where slug='demo-bistro'",
    );
  });

  test("owner changes name, palette and logo; diners see it", async ({
    page,
    browser,
  }) => {
    await signIn(page, "owner@demo.test");
    await page.goto("/admin/settings");
    await page.getByLabel("Name of the place").fill("Saffron House");
    await page.getByRole("radio", { name: "Saffron" }).click();
    await page
      .locator("input#logo")
      .setInputFiles({
        name: "logo.png",
        mimeType: "image/png",
        buffer: png(600, 200),
      });
    await expect(
      page.getByRole("button", { name: "Replace logo" }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved — the menu is updated.")).toBeVisible();

    const theme = JSON.parse(
      sql("select theme_json from restaurants where slug='demo-bistro'"),
    );
    expect(theme).toMatchObject({
      preset: "saffron",
      background: "#fff8ec",
      logoWidth: 512,
      logoHeight: 171,
    });

    const diner = await browser.newPage();
    await diner.goto("/en/menu");
    await expect(
      diner.locator("header").getByText("Saffron House"),
    ).toBeVisible();
    const logo = diner.locator("header img");
    await expect(logo).toHaveAttribute(
      "src",
      /\/img\/.+\/brand\/logo-[0-9a-f]+\.webp$/,
    );
    expect(
      await logo.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth,
      ),
    ).toBe(512);
    expect(
      await diner.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgb(255, 248, 236)");
    await diner.close();
  });

  test("unreadable colours can't be saved", async ({ page }) => {
    await signIn(page, "owner@demo.test");
    await page.goto("/admin/settings");
    await page.getByLabel("Text", { exact: true }).fill("#dddddd");
    await expect(
      page.getByRole("alert").filter({ hasText: "Text on background" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
  });

  test("only owners can change appearance or upload a logo", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin$/);
    const res = await page.request.post("/api/admin/images?kind=logo", {
      data: Buffer.from("RIFF0000WEBPVP8X"),
    });
    expect(res.status()).toBe(403);
  });
});
