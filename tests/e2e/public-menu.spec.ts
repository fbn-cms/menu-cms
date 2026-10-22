import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Runs against the local seeded database (npm run db:reset).
const sql = (statement: string) =>
  execFileSync("docker", [
    "exec",
    "supabase_db_menu-cms",
    "psql",
    "-U",
    "postgres",
    "-qc",
    statement,
  ]);

const itemNames = (page: Page, category: string) =>
  page.locator(`section#c-${category} h3`).allTextContents();

/** The last tab: everything, sold-out dishes included. */
async function openFullMenu(page: Page, locale: string) {
  await page.goto(`/${locale}/menu#full`);
  await expect(page.locator('nav button[aria-pressed="true"]')).toHaveText(
    locale === "fa" ? "منوی کامل" : "Full menu",
  );
}

test.describe("public menu", () => {
  test("/ redirects to the browser's language", async ({ browser }) => {
    const context = await browser.newContext({ locale: "fr-CA" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr\/menu/);
    await context.close();
  });

  test("full menu, within a category: available → limited → sold out", async ({
    page,
  }) => {
    await openFullMenu(page, "en");
    expect(await itemNames(page, "starters")).toEqual([
      "Kashk-e Bademjan",
      "Shirazi Salad",
      "Mirza Ghasemi",
      "Soup of the Day",
    ]);
    const soup = page.locator("section#c-starters li").last();
    await expect(soup.getByText("Sold out today")).toBeVisible();
  });

  test("each dish shows a decorative availability dot in the matching colour", async ({
    page,
  }) => {
    await openFullMenu(page, "en");
    const classes = {
      available: "bg-emerald-500",
      limited: "bg-amber-400",
      unavailable: "bg-red-600",
    };
    const rendered = new Set<string>();
    for (const [state, cls] of Object.entries(classes)) {
      const dot = page
        .locator(`a[data-availability="${state}"]`)
        .first()
        .getByTestId("availability-dot");
      await expect(dot).toHaveAttribute("aria-hidden", "true"); // the text badge carries the meaning
      await expect(dot).toHaveClass(new RegExp(cls));
      rendered.add(
        await dot.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
    }
    expect(rendered.size).toBe(3); // three visibly different colours
  });

  test("sold-out item stays visible and its page says so at the top", async ({
    page,
  }) => {
    await page.goto("/en/item/fesenjan");
    await expect(page.getByRole("status").first()).toContainText(
      "sold out today",
    );
  });

  test("search filters client-side", async ({ page }) => {
    await page.goto("/en/menu");
    await page.getByRole("searchbox").fill("kebab");
    await expect(page.locator("main h3")).toHaveText([
      "Koobideh Kebab",
      "Joojeh Kebab",
    ]);
  });

  test("language switcher preserves the path", async ({ page }) => {
    await page.goto("/en/item/koobideh-kebab");
    await page.getByRole("link", { name: "Français" }).click();
    await expect(page).toHaveURL(/\/fr\/item\/koobideh-kebab$/);
    await expect(page.locator("h1")).toHaveText("Kebab Koobideh");
  });

  test("a dish that sells out moves to the bottom of its category live", async ({
    page,
  }) => {
    try {
      await openFullMenu(page, "en");
      await expect(page.locator("[data-live]")).toHaveAttribute(
        "data-live",
        "live",
        { timeout: 15_000 },
      );
      sql(
        "update items set availability = 'unavailable' where slug = 'kashk-e-bademjan'",
      );
      await expect
        .poll(() => itemNames(page, "starters"), { timeout: 10_000 })
        .toEqual([
          "Shirazi Salad",
          "Mirza Ghasemi",
          "Soup of the Day",
          "Kashk-e Bademjan",
        ]);
    } finally {
      sql(
        "update items set availability = 'available' where slug = 'kashk-e-bademjan'",
      );
    }
  });
});

test.describe("Today's menu (default view)", () => {
  test("opens first, hides sold-out dishes; Full menu is the last tab", async ({
    page,
  }) => {
    await page.goto("/en/menu");
    const tabs = page.getByRole("navigation", { name: "Categories" });
    await expect(tabs.locator(".chip").first()).toHaveText("Today's menu");
    await expect(tabs.locator(".chip").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tabs.locator(".chip").last()).toHaveText("Full menu");
    await expect(page.getByText("Sold out today")).toHaveCount(0);
    expect(await itemNames(page, "starters")).not.toContain("Soup of the Day");

    await tabs.getByRole("button", { name: "Full menu" }).click();
    await expect(page).toHaveURL(/#full$/);
    expect(await itemNames(page, "starters")).toContain("Soup of the Day");

    await tabs.getByRole("button", { name: "Today's menu" }).click();
    expect(await itemNames(page, "starters")).not.toContain("Soup of the Day");
  });

  test("a dish that sells out disappears from Today's menu live", async ({
    page,
  }) => {
    try {
      await page.goto("/en/menu");
      await expect(page.locator("[data-live]")).toHaveAttribute(
        "data-live",
        "live",
        { timeout: 15_000 },
      );
      expect(await itemNames(page, "starters")).toContain("Kashk-e Bademjan");
      sql(
        "update items set availability = 'unavailable' where slug = 'kashk-e-bademjan'",
      );
      await expect
        .poll(() => itemNames(page, "starters"), { timeout: 10_000 })
        .not.toContain("Kashk-e Bademjan");
    } finally {
      sql(
        "update items set availability = 'available' where slug = 'kashk-e-bademjan'",
      );
    }
  });

  test("a category page links to Today's menu first and Full menu last", async ({
    page,
  }) => {
    await page.goto("/en/menu/starters");
    const tabs = page
      .getByRole("navigation", { name: "Categories" })
      .locator(".chip");
    await expect(tabs.first()).toHaveText("Today's menu");
    await expect(tabs.last()).toHaveText("Full menu");
    await tabs.last().click();
    await expect(page).toHaveURL(/\/en\/menu#full$/);
    await expect(
      page.getByRole("button", { name: "Full menu", pressed: true }),
    ).toBeVisible();
  });
});

test.describe("Persian (RTL)", () => {
  test("English fallback text keeps its own reading order and stays inside the column", async ({
    page,
  }) => {
    await page.goto("/fa/menu");
    const desc = page.locator("p", {
      hasText: "Classic French custard infused with Persian saffron.",
    });
    await expect(desc).toBeVisible();
    expect(await desc.evaluate((el) => getComputedStyle(el).unicodeBidi)).toBe(
      "plaintext",
    );
    // The paragraph box stays in the dish column (its text reads left-to-right, as English should).
    const [d, n] = await Promise.all([
      desc.boundingBox(),
      page.getByRole("heading", { name: "Saffron Crème Brûlée" }).boundingBox(),
    ]);
    expect(d && n && Math.abs(d.x + d.width - (n.x + n.width)) < 2).toBe(true);
  });

  test("html is rtl + lang=fa, and nothing overflows horizontally", async ({
    page,
  }) => {
    await page.goto("/fa/menu");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    for (const path of ["/fa/item/koobideh-kebab", "/fa/menu/mains"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
    }
  });

  test("availability dot sits on the photo's outer top corner (mirrored in RTL)", async ({
    page,
  }) => {
    for (const [locale, outerSide] of [
      ["en", "left"],
      ["fa", "right"],
    ] as const) {
      await page.goto(`/${locale}/menu`);
      const card = page.locator("a[data-availability]").first();
      const photo = card.getByTestId("availability-dot").locator("..");
      const [p, d] = await Promise.all([
        photo.boundingBox(),
        card.getByTestId("availability-dot").boundingBox(),
      ]);
      expect(p && d).toBeTruthy();
      const dotCentreX = d!.x + d!.width / 2;
      // Top corner of the photo, on the side away from the dish name.
      expect(Math.abs(d!.y + d!.height / 2 - p!.y)).toBeLessThan(6);
      expect(
        Math.abs(dotCentreX - (outerSide === "left" ? p!.x : p!.x + p!.width)),
      ).toBeLessThan(6);
    }
  });

  test("category nav runs right-to-left", async ({ page }) => {
    await page.goto("/fa/menu");
    const chips = page
      .getByRole("navigation", { name: "دسته‌ها" })
      .getByRole("link");
    const first = await chips.first().boundingBox();
    const last = await chips.last().boundingBox();
    expect(first && last && first.x > last.x).toBe(true); // first category sits at the inline-start (right)
    // Scrolling the nav towards its end moves left in RTL.
    const scrolled = await page
      .getByRole("navigation", { name: "دسته‌ها" })
      .evaluate((el) => {
        el.scrollBy({ left: -200 });
        return el.scrollLeft;
      });
    expect(scrolled).toBeLessThanOrEqual(0);
  });

  test("missing Persian translation falls back to English, never blank", async ({
    page,
  }) => {
    await openFullMenu(page, "fa");
    await expect(page.locator("section#c-starters h3").last()).toHaveText(
      "Soup of the Day",
    );
    const names = await page.locator("main h3").allTextContents();
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
  });
});
