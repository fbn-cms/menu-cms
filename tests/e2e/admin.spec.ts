import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Local stack only: seeded users from supabase/dev-users.sql, emails caught by Mailpit.
const PASSWORD = "local-dev-password";
const MAILPIT = "http://127.0.0.1:54324/api/v1";
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
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/); // wait for the post-login redirect
}

/** Latest link to /auth/confirm in an email sent to `to`. */
async function latestEmailLink(to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`,
    );
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const msg = (await (
        await fetch(`${MAILPIT}/message/${messages[0].ID}`)
      ).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${to}`);
}

test.describe("admin access", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/admin/availability");
    await expect(page).toHaveURL(
      /\/admin\/login\?next=%2Fadmin%2Favailability/,
    );
  });

  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("staff@demo.test");
    await page.getByLabel("Password").fill("nope-nope-nope");
    await page.getByRole("button", { name: "Sign in" }).click();
    // (Next.js also renders an empty role="alert" route announcer, so match by text.)
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
  });

  test("staff land on the 86 board and see no other navigation", async ({
    page,
  }) => {
    await signIn(page, "staff@demo.test");
    await expect(page).toHaveURL(/\/admin\/availability$/);
    await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(
      0,
    );
    await expect(page.getByText("price", { exact: false })).toHaveCount(0);
    for (const path of ["/admin", "/admin/team", "/admin/audit"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/availability$/);
    }
    await expect(page.getByRole("button", { name: /Reset all/ })).toHaveCount(
      0,
    );
  });

  test("admin sees the menu editors, not team, settings or audit", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link")).toHaveText([
      "Dashboard",
      "86 board",
      "Dishes",
      "Categories",
      "Labels",
      "QR code",
    ]);
    await page.goto("/admin/team");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("owner sees everything", async ({ page }) => {
    await signIn(page, "owner@demo.test");
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link"),
    ).toHaveText([
      "Dashboard",
      "86 board",
      "Dishes",
      "Categories",
      "Labels",
      "QR code",
      "Team",
      "Settings",
      "Audit log",
    ]);
  });
});

test.describe("86 board", () => {
  test.afterEach(() => {
    sql(
      "update items set availability='available', availability_note=null, remaining_qty=null, availability_until=null where slug='joojeh-kebab'",
    );
  });

  test("staff 86 a dish in 2 taps; diners see it and the owner sees who did it", async ({
    page,
    browser,
  }) => {
    await signIn(page, "staff@demo.test");
    const row = page.getByRole("listitem").filter({ hasText: "Joojeh Kebab" });
    await row.getByRole("radio", { name: "Sold out" }).click(); // tap 1
    // The sheet pre-selects what the tap already saved ("tonight"), so Save can't silently change it.
    await expect(
      page.getByRole("radio", { name: "Tonight (back at 4 am)" }),
    ).toBeChecked();
    await page.getByLabel("Note for diners").fill("Grill is down");
    await page.getByRole("button", { name: "Save" }).click(); // tap 2
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(row.getByRole("radio", { name: "Sold out" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      sql(
        "select availability || '|' || availability_note from items where slug='joojeh-kebab'",
      ),
    ).toBe("unavailable|Grill is down");

    const diner = await browser.newPage();
    await diner.goto("/en/item/joojeh-kebab");
    await expect(diner.getByRole("status").first()).toContainText(
      "Grill is down",
    );
    await diner.close();

    expect(
      sql(
        "select count(*) from audit_log a join profiles p on p.id = a.actor_id where a.action='availability' and p.email='staff@demo.test'",
      ),
    ).not.toBe("0");
  });

  test("a sold-out time that has passed shows as available, before the hourly job runs", async ({
    page,
  }) => {
    sql(
      "update items set availability='unavailable', availability_until=now() - interval '1 hour' where slug='joojeh-kebab'",
    );
    await signIn(page, "staff@demo.test");
    const row = page.getByRole("listitem").filter({ hasText: "Joojeh Kebab" });
    await expect(row.getByRole("radio", { name: "Available" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("staff toggle Chef's pick on the 86 board; an open menu shows it live", async ({
    page,
    browser,
  }) => {
    sql("update items set is_featured=false where slug='joojeh-kebab'");
    const diner = await browser.newPage();
    try {
      await diner.goto("/en/menu");
      await expect(diner.locator("[data-live]")).toHaveAttribute(
        "data-live",
        "live",
        { timeout: 15_000 },
      );
      const dish = diner.locator("a", {
        has: diner.getByRole("heading", { name: "Joojeh Kebab" }),
      });
      await expect(dish.getByText("Chef's pick")).toHaveCount(0);

      await signIn(page, "staff@demo.test");
      const toggle = page.getByRole("button", {
        name: "Joojeh Kebab: Chef's pick",
      });
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click(); // one tap
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(() =>
          sql("select is_featured from items where slug='joojeh-kebab'"),
        )
        .toBe("t");
      await expect(dish.getByText("Chef's pick")).toBeVisible({
        timeout: 10_000,
      }); // live, no reload

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(dish.getByText("Chef's pick")).toHaveCount(0, {
        timeout: 10_000,
      });
    } finally {
      await diner.close();
      sql("update items set is_featured=false where slug='joojeh-kebab'");
    }
  });

  test("the dish editor no longer has a Chef's pick switch", async ({
    page,
  }) => {
    await signIn(page, "admin@demo.test");
    const id = sql("select id from items where slug='koobideh-kebab'");
    await page.goto(`/admin/items/${id}`);
    await expect(page.getByText("Feature it")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "86 board" }).last(),
    ).toBeVisible();
  });

  test("a stale write is refused instead of overwriting", async ({ page }) => {
    await signIn(page, "staff@demo.test");
    const row = page.getByRole("listitem").filter({ hasText: "Joojeh Kebab" });
    await expect(row).toBeVisible(); // board loaded with the current version
    sql("update items set availability='limited' where slug='joojeh-kebab'"); // someone else, after page load
    await row.getByRole("radio", { name: "Sold out" }).click();
    await expect(
      page.getByText(/Someone else just changed this dish/),
    ).toBeVisible();
    await expect(row.getByRole("radio", { name: "Limited" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("email flows", () => {
  test("owner can send a team member a password link", async ({ page }) => {
    await signIn(page, "owner@demo.test");
    await page.goto("/admin/team");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "staff@demo.test" });
    await row.getByRole("button", { name: "Send password link" }).click();
    await expect(
      page.getByText("Password link sent to staff@demo.test"),
    ).toBeVisible();
    expect(await latestEmailLink("staff@demo.test")).toContain("type=recovery");
  });

  test("owner invites a staff member, who sets a password and lands on the board", async ({
    page,
    browser,
  }) => {
    const email = `new-${Date.now()}@demo.test`;
    try {
      await signIn(page, "owner@demo.test");
      await page.goto("/admin/team");
      await page.getByLabel("Name").fill("New Server");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Send invite" }).click();
      await expect(page.getByText(`Invite sent to ${email}.`)).toBeVisible();

      const invitee = await browser.newPage();
      await invitee.goto(await latestEmailLink(email));
      await expect(invitee).toHaveURL(/\/admin\/set-password$/);
      await invitee.getByLabel("New password").fill("a long enough password");
      await invitee
        .getByLabel("Repeat password")
        .fill("a long enough password");
      await invitee.getByRole("button", { name: "Save password" }).click();
      await expect(invitee).toHaveURL(/\/admin\/availability$/);
      await invitee.close();
    } finally {
      sql(`delete from auth.users where email='${email}'`);
    }
  });

  test("magic link signs in", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.getByLabel("Email").fill("admin@demo.test");
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "a link is on its way",
    );
    await page.goto(await latestEmailLink("admin@demo.test"));
    await expect(page).toHaveURL(/\/admin$/);
  });
});
