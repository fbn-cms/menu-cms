import { execFileSync } from "node:child_process";
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

test.describe("header", () => {
  test("language menu sits on the row above the logo/name", async ({
    page,
  }) => {
    await page.goto("/en/menu");
    const langs = await page
      .getByRole("navigation", { name: "Language" })
      .boundingBox();
    const brand = await page.getByTestId("brand").boundingBox();
    expect(langs && brand && langs.y + langs.height <= brand.y + 1).toBe(true);
  });

  test("tapping the name 5 times quickly reveals the staff login (4 taps don't)", async ({
    page,
  }) => {
    await page.goto("/en/menu");
    const brand = page.getByTestId("brand");
    const staff = page.getByRole("link", { name: "Staff login" });
    for (let i = 0; i < 4; i++) await brand.click();
    await expect(staff).toHaveCount(0);
    await brand.click();
    await expect(staff).toBeVisible();
    await page.reload(); // stays revealed for this session
    await expect(staff).toBeVisible();
    await staff.click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("footer", () => {
  test.afterEach(() => {
    sql(
      "update restaurants set address='123 Queen St W, Toronto, ON', phone='+1 416 555 0100', theme_json='{}' where slug='demo-bistro'",
    );
  });

  // Changes go through the real Settings page, which refreshes the cached public menu.
  async function saveContact(
    page: Page,
    values: { address: string; phone: string; copyright: string },
  ) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("owner@demo.test");
    await page.getByLabel("Password").fill("local-dev-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await page.goto("/admin/settings");
    await page.getByLabel("Address").fill(values.address);
    await page.getByLabel("Phone").fill(values.phone);
    await page.getByLabel("Copyright holder").fill(values.copyright);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved — the menu is updated.")).toBeVisible();
  }

  test("shows address, phone and copyright from settings", async ({ page }) => {
    await saveContact(page, {
      address: "45 King St E, Toronto, ON",
      phone: "+1 (416) 555-0199",
      copyright: "FBN CMS",
    });
    await page.goto("/en/menu");
    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("link", { name: /Address: 45 King St E/ }),
    ).toHaveAttribute("href", /google\.com\/maps\/search/);
    await expect(
      footer.getByRole("link", { name: /Call: \+1 \(416\) 555-0199/ }),
    ).toHaveAttribute("href", "tel:+14165550199");
    await expect(footer).toContainText(
      `© ${new Date().getFullYear()} FBN CMS. All rights reserved.`,
    );
  });

  test("empty address/phone are hidden; copyright falls back to the restaurant name", async ({
    page,
  }) => {
    await saveContact(page, { address: "", phone: "", copyright: "" });
    await page.goto("/fr/menu");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link")).toHaveCount(0);
    await expect(footer).toContainText("Demo Bistro. Tous droits réservés.");
  });

  test("Persian footer and header don't overflow at 360px", async ({
    page,
  }) => {
    await page.goto("/fa/menu");
    await expect(page.getByRole("contentinfo")).toContainText(
      "تمامی حقوق محفوظ است",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
});
