import { expect, test, type Page } from "@playwright/test";
import { signIn, sql } from "./helpers";

// Local runs use AI_FAKE=1: canned output tagged with the provider ("[EN] …", "[anthropic:FR] …"),
// and key validation accepts only keys starting with "test-valid-". Encryption is real.

const FAKE_CLAUDE_KEY = "test-valid-anthropic-key-0000000000AbCd";

async function openNewDish(page: Page) {
  await page.goto("/admin/items/new");
  await page.getByLabel("Category").selectOption({ label: "Mains" });
  await page.getByRole("textbox", { name: /^Price \(/ }).fill("22");
}

test.describe("AI provider keys (Settings → AI)", () => {
  test.beforeEach(() => sql("delete from ai_settings"));
  test.afterAll(() => sql("delete from ai_settings"));

  test("owner adds a Claude key (checked, encrypted, last 4 shown), it's used, then removed", async ({
    page,
  }) => {
    await signIn(page, "owner@demo.test");
    await page.goto("/admin/settings");
    const key = page.getByLabel(/^API key — from console\.anthropic\.com/);

    await key.fill("not-a-real-key-1234567890");
    await page
      .getByRole("button", { name: "Check & save key" })
      .first()
      .click();
    await expect(
      page.getByText("The key was rejected by the provider."),
    ).toBeVisible();
    expect(sql("select count(*) from ai_settings")).toBe("0");

    await key.fill(FAKE_CLAUDE_KEY);
    await page
      .getByRole("button", { name: "Check & save key" })
      .first()
      .click();
    await expect(page.getByTestId("anthropic-status")).toHaveText(
      "Connected · ••••AbCd",
    );
    const [provider, enc, hint] = sql(
      "select provider, anthropic_key_enc, anthropic_key_hint from ai_settings",
    ).split("|");
    expect(provider).toBe("anthropic"); // first key → used straight away
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain("test-valid"); // never stored in clear
    expect(hint).toBe("AbCd");
    expect(
      sql(
        "select count(*) from audit_log where action='ai_key_added' and after_json::text like '%test-valid%'",
      ),
    ).toBe("0");
    // The page never receives the key itself.
    expect(await page.content()).not.toContain(FAKE_CLAUDE_KEY);

    // The editor now says it uses Claude, and the server really calls the Claude path.
    await openNewDish(page);
    await expect(
      page.getByText(/Using Claude \(claude-opus-5-5\)/),
    ).toBeVisible();
    await page.getByLabel("Name (required)").fill("Tahchin");
    await page.getByRole("button", { name: "Generate from English" }).click();
    await page.getByRole("tab", { name: /French/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "[anthropic:FR] Tahchin",
    );

    // Remove → back to the free AI.
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Remove" }).first().click();
    await page.getByRole("button", { name: "Remove key" }).click();
    await expect(page.getByText(/Claude key removed/)).toBeVisible();
    expect(
      sql(
        "select provider || '|' || coalesce(anthropic_key_enc, 'null') from ai_settings",
      ),
    ).toBe("cloudflare|null");
  });

  test("admins and staff can't manage keys", async ({ page }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("Generate in the dish editor", () => {
  test.afterEach(() =>
    sql("delete from items where slug in ('test-tahchin-fa','test-ai-dish')"),
  );

  test("type the name in Persian → English and French are filled, flagged for review, and saved", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await openNewDish(page);
    await page.getByRole("tab", { name: /Persian/ }).click();
    await page.getByLabel("Name", { exact: true }).fill("ته‌چین");
    await page.getByLabel(/Notes for the AI/).fill("برنج زعفرانی با مرغ");
    await expect(page.getByText(/Using the free Cloudflare AI/)).toBeVisible();
    await page.getByRole("button", { name: "Generate from Persian" }).click();

    // Jumps to the first filled language, flagged for review.
    await expect(page.getByRole("tab", { name: /English/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Written by AI" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name (required)")).toHaveValue("[EN] ته‌چین");
    // Source text kept verbatim; its missing description written.
    await page.getByRole("tab", { name: /Persian/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "ته‌چین",
    );
    await expect(
      page.getByLabel("Short description — on the menu list"),
    ).toHaveValue(/^\[FA\] ته‌چین, from our mains\.$/);
    await page.getByRole("tab", { name: /French/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "[FR] ته‌چین",
    );

    await page.getByLabel("Web address").fill("test-tahchin-fa");
    await page.getByRole("button", { name: "Create dish" }).click();
    await expect(
      page.getByText("Dish created — it's on the menu."),
    ).toBeVisible();
    expect(sql("select name from items where slug='test-tahchin-fa'")).toBe(
      "[EN] ته‌چین",
    );
    expect(
      sql(
        "select string_agg(t.locale || '=' || t.name, ',' order by t.locale) from item_translations t join items i on i.id=t.item_id where i.slug='test-tahchin-fa'",
      ),
    ).toBe("fa=ته‌چین,fr=[FR] ته‌چین");
  });

  test("existing translations are kept unless 'Replace' is ticked; option names too", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await openNewDish(page);
    await page.getByLabel("Name (required)").fill("Test AI Dish");
    await page.getByRole("button", { name: "Add size or option" }).click();
    await page.getByLabel("Option name").fill("Large");
    await page.getByRole("tab", { name: /French/ }).click();
    await page.getByLabel("Name", { exact: true }).fill("Mon nom à moi");
    await page.getByRole("tab", { name: /English/ }).click();

    await page.getByRole("button", { name: "Generate from English" }).click();
    await page.getByRole("tab", { name: /French/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Mon nom à moi",
    ); // kept
    await expect(page.getByLabel("French name")).toHaveValue("[FR] Large");
    await expect(page.getByLabel("Persian name")).toHaveValue("[FA] Large");

    await page.getByRole("tab", { name: /English/ }).click();
    await page.getByLabel(/Replace text already written/).check();
    await page.getByRole("button", { name: "Generate from English" }).click();
    await page.getByRole("tab", { name: /French/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "[FR] Test AI Dish",
    ); // replaced on request
  });

  test("staff can't use the AI", async ({ page }) => {
    await signIn(page, "staff@demo.test");
    const res = await page.request.post("/api/admin/ai", {
      data: { source: "en", name: "x" },
    });
    expect(res.status()).toBe(403);
  });
});
