import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

// Runs with AI_FAKE=1 (see .env.local): deterministic "[AI]/[FA]/[FR]" output, no real AI calls.

test.describe("AI writing and translation", () => {
  test.afterAll(() => sql("delete from items where slug='test-tahchin'"));

  test("write a description, translate it (incl. option names), review, save", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/items/new");
    await page.getByLabel("Name (required)").fill("Test Tahchin");
    await page.getByLabel("Category").selectOption({ label: "Mains" });
    await page.getByRole("textbox", { name: /^Price \(/ }).fill("22");
    await page.getByRole("button", { name: "Add size or option" }).click();
    await page.getByLabel("Option name").fill("Large");

    await page
      .getByLabel(/Notes for the AI/)
      .fill("baked saffron rice cake with chicken");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(
      page.getByLabel("Short description — on the menu list"),
    ).toHaveValue("[AI] Test Tahchin, from our mains.");
    await expect(
      page.getByLabel("Full description — on the dish page"),
    ).toHaveValue(/baked saffron rice cake with chicken/);

    await page
      .getByRole("button", { name: "Translate to Persian & French" })
      .click();
    // Lands on the Persian tab, flagged for review.
    await expect(page.getByRole("tab", { name: /Persian/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Machine-translated" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "[FA] Test Tahchin",
    );
    await expect(page.getByLabel("Persian name")).toHaveValue("[FA] Large");
    await expect(page.getByLabel("French name")).toHaveValue("[FR] Large");
    await page.getByRole("button", { name: "Looks good" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Machine-translated" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Create dish" }).click();
    await expect(
      page.getByText("Dish created — it's on the menu."),
    ).toBeVisible();
    expect(
      sql(
        "select string_agg(t.locale || '=' || t.name, ',' order by t.locale) from item_translations t join items i on i.id=t.item_id where i.slug='test-tahchin'",
      ),
    ).toBe("fa=[FA] Test Tahchin,fr=[FR] Test Tahchin");
    expect(
      sql(
        "select string_agg(vt.locale || '=' || vt.name, ',' order by vt.locale) from item_variant_translations vt join item_variants v on v.id=vt.variant_id join items i on i.id=v.item_id where i.slug='test-tahchin'",
      ),
    ).toBe("fa=[FA] Large,fr=[FR] Large");
  });

  test("staff can't use the AI endpoint", async ({ page }) => {
    await signIn(page, "staff@demo.test");
    const res = await page.request.post("/api/admin/ai", {
      data: { task: "describe", name: "x" },
    });
    expect(res.status()).toBe(403);
  });
});
