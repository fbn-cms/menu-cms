// Applies auth settings to a hosted Supabase project via the Management API, so demo and prod
// are configured identically and repeatably.
//
//   node scripts/configure-supabase-auth.mjs demo|prod [--dry-run]
//
// Reads: .env.<env> (NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL)
//        .env.cloudflare (SUPABASE_ACCESS_TOKEN, GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD)
import { readFileSync } from "node:fs";

const [envName, flag] = process.argv.slice(2);
if (!["demo", "prod"].includes(envName))
  throw new Error("usage: configure-supabase-auth.mjs demo|prod [--dry-run]");
const readEnv = (file) =>
  Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [
        l.slice(0, l.indexOf("=")),
        l.slice(l.indexOf("=") + 1).trim(),
      ]),
  );
const env = { ...readEnv(`.env.${envName}`), ...readEnv(".env.cloudflare") };
const need = (k) =>
  env[k] ||
  (() => {
    throw new Error(`${k} missing`);
  })();

const site = need("NEXT_PUBLIC_SITE_URL");
const ref = new URL(need("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
const template = (name) =>
  readFileSync(`supabase/templates/${name}.html`, "utf8");

const config = {
  site_url: site,
  // Only these may receive auth redirects. Add the custom domain here BEFORE cutting over (§11).
  uri_allow_list: [`${site}/auth/confirm`, `${site}/admin/**`].join(","),
  disable_signup: true, // invite-only
  external_email_enabled: true, // email provider ON (password + magic link)
  external_anonymous_users_enabled: false,
  password_min_length: 10,
  mailer_otp_exp: 3600,
  mailer_subjects_invite: "You're invited to the menu admin",
  mailer_templates_invite_content: template("invite"),
  mailer_subjects_magic_link: "Your sign-in link",
  mailer_templates_magic_link_content: template("magic_link"),
  mailer_subjects_recovery: "Choose a new password",
  mailer_templates_recovery_content: template("recovery"),
};
// Gmail SMTP (App Password, ~500 messages/day). Optional: without it, password sign-in still
// works but invites, magic links and password resets can't be emailed.
if (env.GMAIL_SMTP_APP_PASSWORD) {
  Object.assign(config, {
    smtp_host: "smtp.gmail.com",
    smtp_port: "465",
    smtp_user: need("GMAIL_SMTP_USER"),
    smtp_pass: env.GMAIL_SMTP_APP_PASSWORD.replace(/\s+/g, ""),
    smtp_admin_email: need("GMAIL_SMTP_USER"),
    smtp_sender_name: "Restaurant menu",
    rate_limit_email_sent: 30,
  });
} else {
  console.warn(
    "No GMAIL_SMTP_APP_PASSWORD: configuring without email delivery.",
  );
}

if (flag === "--dry-run") {
  console.log(ref, {
    ...config,
    smtp_pass: "***",
    ...Object.fromEntries(
      Object.keys(config)
        .filter((k) => k.includes("templates"))
        .map((k) => [k, "<html>"]),
    ),
  });
  process.exit(0);
}
const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${need("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  },
);
if (!res.ok) {
  console.error(`${envName} (${ref}): ${res.status} ${await res.text()}`);
  process.exit(1);
}
const applied = await res.json();
console.log(
  `${envName} (${ref}) configured: site_url=${applied.site_url} signup_disabled=${applied.disable_signup} email=${applied.external_email_enabled} smtp=${applied.smtp_host ?? "none"} min_password=${applied.password_min_length}`,
);
