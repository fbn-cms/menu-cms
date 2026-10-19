import type { Metadata } from "next";
import { Download, ExternalLink, Info } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { qrSvg } from "@/lib/qr/code";
import { qrPayloadUrl, qrPrintable } from "@/lib/qr/url";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CreateQrButton, QrSettings } from "./qr-settings";

export const metadata: Metadata = { title: "QR code" };

const since = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

export default async function QrPage() {
  await requireRole("owner", "admin");
  const supabase = await createSupabaseServer();
  const [{ data: codes }, { data: categories }] = await Promise.all([
    supabase
      .from("qr_codes")
      .select("id, label, slug, target_path, is_active")
      .order("created_at")
      .limit(1),
    supabase
      .from("categories")
      .select("name, slug")
      .eq("is_published", true)
      .order("sort_order"),
  ]);
  const qr = codes?.[0];
  const printable = qrPrintable();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">QR code</h1>
        <p className="text-muted-foreground text-sm">
          One code for every table. Guests scan it with the phone camera and
          land on the menu.
        </p>
      </div>

      {!printable && (
        <p className="flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            This is the test site, so the code below is for trying on screen
            only. Printable codes (PDF table cards, PNG, SVG) are made in the
            admin of the live site, so every printed code opens the live menu.
          </span>
        </p>
      )}

      {!qr ? (
        <div className="rounded-2xl border p-6 text-center">
          <p className="text-muted-foreground mb-3 text-sm">No QR code yet.</p>
          <CreateQrButton />
        </div>
      ) : (
        <QrDetails
          qr={qr}
          categories={categories ?? []}
          printable={printable}
        />
      )}
    </div>
  );
}

async function QrDetails({
  qr,
  categories,
  printable,
}: {
  qr: {
    id: string;
    label: string;
    slug: string;
    target_path: string;
    is_active: boolean;
  };
  categories: { name: string; slug: string }[];
  printable: boolean;
}) {
  const supabase = await createSupabaseServer();
  const count = (days?: number) => {
    let q = supabase
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .eq("qr_code_id", qr.id)
      .eq("is_bot", false);
    if (days) q = q.gte("occurred_at", since(days));
    return q;
  };
  const [today, week, month, all, devices] = await Promise.all([
    count(1),
    count(7),
    count(30),
    count(),
    supabase
      .from("scan_events")
      .select("ua_family")
      .eq("qr_code_id", qr.id)
      .eq("is_bot", false)
      .gte("occurred_at", since(30))
      .limit(5000),
  ]);
  const byDevice = new Map<string, number>();
  for (const d of devices.data ?? []) {
    const k = d.ua_family ?? "Unknown";
    byDevice.set(k, (byDevice.get(k) ?? 0) + 1);
  }
  const topDevices = [...byDevice].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const url = qrPayloadUrl(qr.slug);
  const download = (format: string) =>
    `/api/admin/qr/${qr.id}?format=${format}`;

  return (
    <>
      <section
        aria-labelledby="code"
        className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[14rem_1fr]"
      >
        <h2 id="code" className="sr-only">
          The code
        </h2>
        <div
          className="mx-auto w-56 max-w-full overflow-hidden rounded-xl border bg-white"
          data-testid="qr-preview"
          // Our own SVG: built from the module grid; the only text (the title) is escaped.
          dangerouslySetInnerHTML={{
            __html: qrSvg(url, `${qr.label} QR code`),
          }}
        />
        <div className="min-w-0 space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Opens</p>
            <p className="font-medium break-all" data-testid="qr-url">
              {url}
            </p>
          </div>
          <a
            href={`/t/${qr.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 underline underline-offset-4"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Test the link (counts as a scan)
          </a>
          {printable && (
            <div className="space-y-2">
              <p className="font-medium">Download</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={download("pdf")}
                  className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-medium"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Table cards (PDF)
                </a>
                <a
                  href={download("png")}
                  className="hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3"
                >
                  <Download aria-hidden="true" className="size-4" />
                  PNG
                </a>
                <a
                  href={download("svg")}
                  className="hover:bg-muted inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3"
                >
                  <Download aria-hidden="true" className="size-4" />
                  SVG
                </a>
              </div>
              <p className="text-muted-foreground">
                Table cards: four per Letter page; print at &ldquo;Actual
                size&rdquo; and cut along the dashed lines. PNG suits print
                shops, SVG suits designers. Keep any code at least 3&nbsp;cm
                wide, and test one print with an iPhone and an Android camera
                before printing many.
              </p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="scans" className="space-y-3">
        <h2 id="scans" className="font-semibold">
          Scans
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Today" value={today.count ?? 0} />
          <Stat label="Last 7 days" value={week.count ?? 0} />
          <Stat label="Last 30 days" value={month.count ?? 0} />
          <Stat label="All time" value={all.count ?? 0} />
        </div>
        {topDevices.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Phones, last 30 days:{" "}
            {topDevices.map(([k, n]) => `${k} ${n}`).join(" · ")}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          Anonymous: only the browser type and time are kept. Link previews and
          bots are not counted.
        </p>
      </section>

      <QrSettings
        id={qr.id}
        label={qr.label}
        targetPath={qr.target_path}
        isActive={qr.is_active}
        categories={categories}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
