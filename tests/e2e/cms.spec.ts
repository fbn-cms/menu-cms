import { expect, test } from "@playwright/test";
import { png, signIn, sql } from "./helpers";

// Each test creates its own content through the UI and deletes it through the UI at the end,
// so the public menu cache is refreshed exactly as in real use.

test.describe("content management", () => {
  test.afterAll(() => {
    // Safety net if a test failed midway (the cache may then be stale until it expires).
    sql(
      "delete from items where slug in ('test-barg-kebab'); delete from categories where slug in ('test-drinks'); delete from tags where label in ('Test Spicy')",
    );
  });

  test("admin creates a dish with photos, labels, an option and a Persian name; diners see it; delete removes it", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/items/new");
    await page.getByLabel("Name (required)").fill("Test Barg Kebab");
    await expect(page.getByLabel("Web address")).toHaveValue("test-barg-kebab"); // auto slug
    await page
      .getByLabel("Short description — on the menu list")
      .fill("Saffron lamb fillet on the grill.");
    await page.getByLabel("Category").selectOption({ label: "Mains" });
    await page.getByRole("textbox", { name: /^Price \(/ }).fill("31.50");
    await page.getByRole("button", { name: "Halal" }).click();
    await page.getByRole("button", { name: "Add size or option" }).click();
    await page.getByLabel("Option name").fill("Double skewer");
    await page.getByLabel("Price", { exact: true }).fill("44");

    // Persian tab
    await page.getByRole("tab", { name: /Persian/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "dir",
      "rtl",
    );
    await page.getByLabel("Name", { exact: true }).fill("کباب برگ تست");

    // Photos: square thumbnail and 4:3 page photo, through the cropper
    await page
      .getByTestId("file-icon")
      .setInputFiles({
        name: "a.png",
        mimeType: "image/png",
        buffer: png(900, 700),
      });
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(
      page.getByRole("img", { name: "Menu thumbnail preview" }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByTestId("file-hero")
      .setInputFiles({
        name: "b.png",
        mimeType: "image/png",
        buffer: png(2400, 1600, [40, 90, 30]),
      });
    await page.getByRole("button", { name: "Use photo" }).click();
    await expect(
      page.getByRole("img", { name: "Dish page photo preview" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Create dish" }).click();
    await expect(
      page.getByText("Dish created — it's on the menu."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/items\/[0-9a-f-]{36}$/);

    const row = sql(
      "select price_cents, icon_key, hero_key, length(icon_lqip) > 50, (select count(*) from item_variants v where v.item_id = i.id), (select price_delta_cents from item_variants v where v.item_id = i.id) from items i where slug='test-barg-kebab'",
    );
    const [price, icon, hero, lqip, variants, delta] = row.split("|");
    expect(price).toBe("3150");
    expect(icon).toMatch(/\/icon-[0-9a-f]+\.webp$/);
    expect(hero).toMatch(/\/hero-[0-9a-f]+\.webp$/);
    expect(lqip).toBe("t");
    expect(variants).toBe("1");
    expect(delta).toBe("1250"); // 44.00 − 31.50 stored as a difference

    const diner = await browser.newPage();
    await diner.goto("/en/menu");
    const card = diner.locator("a", {
      has: diner.getByRole("heading", { name: "Test Barg Kebab" }),
    });
    await expect(card).toBeVisible();
    const thumb = card.locator("img");
    expect(
      await thumb.evaluate(
        (i: HTMLImageElement) => i.complete && i.naturalWidth,
      ),
    ).toBe(400); // 400×400 icon
    await diner.goto("/en/item/test-barg-kebab");
    const heroImg = diner.locator("main img").first();
    await expect(heroImg).toBeVisible();
    expect(
      await heroImg.evaluate((i: HTMLImageElement) => [
        i.naturalWidth,
        i.naturalHeight,
      ]),
    ).toEqual([1600, 1200]); // 4:3
    await expect(diner.getByText("Double skewer")).toBeVisible();
    await diner.goto("/fa/item/test-barg-kebab");
    await expect(diner.locator("h1")).toHaveText("کباب برگ تست");
    await diner.close();

    // Delete through the UI → gone from the menu; photos queued for nightly cleanup.
    await page.getByRole("button", { name: "Delete dish" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/items$/);
    expect(
      sql(
        `select count(*) from image_deletions where key in ('${icon}', '${hero}')`,
      ),
    ).toBe("2");
    const after = await browser.newPage();
    await after.goto("/en/menu");
    await expect(
      after.getByRole("heading", { name: "Test Barg Kebab" }),
    ).toHaveCount(0);
    await after.close();
  });

  test("a stale save is refused instead of overwriting someone else's change", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    const id = sql("select id from items where slug='faloodeh'");
    await page.goto(`/admin/items/${id}`);
    await page.getByRole("textbox", { name: /^Price \(/ }).fill("8.25");
    sql("update items set calories = calories + 1 where slug='faloodeh'"); // someone else saves meanwhile
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText(/Someone else changed this dish/),
    ).toBeVisible();
    expect(sql("select price_cents from items where slug='faloodeh'")).toBe(
      "800",
    );
    sql("update items set calories = calories - 1 where slug='faloodeh'");
  });

  test("categories: create with translations, reorder, and empty ones stay off the menu", async ({
    page,
    browser,
  }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/categories/new");
    await page.getByLabel("Name (required)").fill("Test Drinks");
    await page.getByRole("tab", { name: /French/ }).click();
    await page.getByLabel("Name", { exact: true }).fill("Boissons test");
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Test Drinks" }),
    ).toContainText("0 dishes");

    const diner = await browser.newPage();
    await diner.goto("/en/menu");
    await expect(
      diner.getByRole("heading", { name: "Test Drinks" }),
    ).toHaveCount(0); // empty → hidden
    await diner.close();

    // Reorder: move Desserts up above Mains
    await page.getByRole("button", { name: "Move Desserts up" }).click();
    await expect
      .poll(() =>
        sql(
          "select string_agg(slug, ',' order by sort_order) from categories where slug in ('starters','mains','desserts')",
        ),
      )
      .toBe("starters,desserts,mains");
    await page.getByRole("button", { name: "Move Desserts down" }).click();
    await expect
      .poll(() =>
        sql(
          "select string_agg(slug, ',' order by sort_order) from categories where slug in ('starters','mains','desserts')",
        ),
      )
      .toBe("starters,mains,desserts");

    await page
      .getByRole("listitem")
      .filter({ hasText: "Test Drinks" })
      .getByRole("link", { name: "Edit" })
      .click();
    await page.getByRole("button", { name: "Delete category" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await expect(page.getByText("Test Drinks")).toHaveCount(0);
  });

  test("a category with dishes can't be deleted", async ({ page }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/categories");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Starters" })
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(
      page.getByRole("button", { name: "Delete category" }),
    ).toBeDisabled();
  });

  test("labels: the icon is suggested from the text and can be overridden", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/tags");
    await page
      .getByRole("region", { name: "Highlights" })
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByLabel("English (required)").fill("Test Spicy");
    await expect(page.getByRole("radio", { name: "flame" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByLabel("Persian").fill("تند");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Label added.")).toBeVisible();
    expect(
      sql("select icon || '|' || kind from tags where label='Test Spicy'"),
    ).toBe("flame|feature");
    expect(
      sql(
        "select tt.label from tag_translations tt join tags t on t.id=tt.tag_id where t.label='Test Spicy' and locale='fa'",
      ),
    ).toBe("تند");

    await page.getByRole("button", { name: "Edit Test Spicy" }).click();
    await page.getByRole("radio", { name: "star" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    expect(sql("select icon from tags where label='Test Spicy'")).toBe("star");

    await page.getByRole("button", { name: "Edit Test Spicy" }).click();
    await page.getByRole("button", { name: "Delete label" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Label deleted.")).toBeVisible();
  });

  test("bulk hide removes dishes from the menu; show brings them back", async ({
    page,
    browser,
  }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/items");
    await page.getByLabel("Select Faloodeh").check();
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(page.getByText("1 dish hidden from the menu.")).toBeVisible();
    const diner = await browser.newPage();
    await diner.goto("/en/menu");
    await expect(diner.getByRole("heading", { name: "Faloodeh" })).toHaveCount(
      0,
    );
    await page.getByLabel("Select Faloodeh").check();
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByText("1 dish shown on the menu.")).toBeVisible();
    await diner.goto("/en/menu");
    await expect(
      diner.getByRole("heading", { name: "Faloodeh" }),
    ).toBeVisible();
    await diner.close();
  });

  test("missing-translation filter and indicator", async ({ page }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/items");
    await page.getByLabel("Missing translations only").check();
    const list = page.getByRole("listitem");
    await expect(list.filter({ hasText: "Soup of the Day" })).toBeVisible();
    await expect(list.filter({ hasText: "Mirza Ghasemi" })).toBeVisible(); // no French
    await expect(list.filter({ hasText: "Koobideh Kebab" })).toHaveCount(0); // complete
  });

  test("staff can't reach the editors or upload dish photos", async ({
    page,
  }) => {
    await signIn(page, "staff@demo.test");
    for (const path of [
      "/admin/items",
      "/admin/items/new",
      "/admin/categories",
      "/admin/tags",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/availability$/);
    }
    const res = await page.request.post(
      "/api/admin/images?kind=icon&item=00000000-0000-4000-8000-0000000000d1",
      { data: Buffer.from("x") },
    );
    expect(res.status()).toBe(403);
  });
});
