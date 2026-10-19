import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

// Phase 6: the restaurant-wide code (seeded slug "main"), scan logging and downloads.
const scans = () =>
  Number(
    sql(
      "select count(*) from scan_events s join qr_codes q on q.id = s.qr_code_id where q.slug = 'main' and not s.is_bot",
    ),
  );
const resetQr = () =>
  sql(
    "update qr_codes set label='Main menu', target_path='/', is_active=true where slug='main'",
  );

test.describe("QR code", () => {
  test.beforeEach(resetQr);
  test.afterAll(resetQr);

  test("scanning opens the menu and is counted once", async ({ page }) => {
    const before = scans();
    await page.goto("/t/main");
    await expect(page).toHaveURL(/\/(en|fa|fr)\/menu/);
    expect(scans()).toBe(before + 1);
  });

  test("an unknown code still lands on the menu", async ({ page }) => {
    await page.goto("/t/does-not-exist");
    await expect(page).toHaveURL(/\/(en|fa|fr)\/menu/);
  });

  test("link-preview bots are not counted as scans", async ({ request }) => {
    const before = scans();
    const res = await request.get("/t/main", {
      headers: { "user-agent": "WhatsApp/2.23.20.0" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    expect(scans()).toBe(before);
  });

  test("owner re-points the code to a section without reprinting", async ({
    page,
  }) => {
    await signIn(page, "owner@demo.test");
    await page.goto("/admin/qr");
    await expect(page.getByTestId("qr-url")).toHaveText(/\/t\/main$/);
    await page
      .getByLabel("Opens", { exact: true })
      .selectOption({ label: "Section: Desserts" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();

    await page.goto("/t/main");
    await expect(page).toHaveURL(/\/(en|fa|fr)\/menu\/desserts/);
  });

  test("downloads are real SVG, PNG and PDF files", async ({ page }) => {
    await signIn(page, "owner@demo.test");
    const id = sql("select id from qr_codes where slug='main'");
    const get = (format: string) =>
      page.request.get(`/api/admin/qr/${id}?format=${format}`);
    const svg = await get("svg");
    expect(svg.headers()["content-type"]).toBe("image/svg+xml");
    expect(await svg.text()).toMatch(/^<svg /);
    const png = await get("png");
    expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
    const pdf = await get("pdf");
    expect(pdf.headers()["content-disposition"]).toMatch(/table-cards\.pdf/);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("staff can't download codes", async ({ page }) => {
    await signIn(page, "staff@demo.test");
    const id = sql("select id from qr_codes where slug='main'");
    const res = await page.request.get(`/api/admin/qr/${id}?format=svg`);
    expect(res.status()).toBe(403);
  });
});
