import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import { qrPng, qrSvg } from "@/lib/qr/code";
import { tableCardsPdf } from "@/lib/qr/pdf";
import { qrPayloadUrl, qrPrintable, siteHost } from "@/lib/qr/url";
import { readTheme } from "@/lib/theme";
import { createSupabaseServer } from "@/lib/supabase/server";

// Download a QR code as SVG / PNG / print-ready PDF table cards (owner or admin).
//   GET /api/admin/qr/<id>?format=svg|png|pdf
// Only where the site's address is final (spec §11): printed codes can't be changed later.
const FORMAT = z.enum(["svg", "png", "pdf"]);
const TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  pdf: "application/pdf",
} as const;

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/admin/qr/[id]">,
) {
  const ctx = await getStaffContext().catch(() => null);
  if (!ctx) return new Response("Sign in again.", { status: 401 });
  if (ctx.profile.role === "staff")
    return new Response("Not allowed.", { status: 403 });
  if (!qrPrintable())
    return new Response("Printable QR codes are made on the live site only.", {
      status: 403,
    });
  const { id } = await params;
  const format = FORMAT.safeParse(
    new URL(request.url).searchParams.get("format"),
  );
  if (!z.uuid().safeParse(id).success || !format.success)
    return new Response("Bad request.", { status: 400 });

  const supabase = await createSupabaseServer(); // RLS: this restaurant's editors only
  const [{ data: qr }, { data: restaurant }] = await Promise.all([
    supabase.from("qr_codes").select("slug").eq("id", id).maybeSingle(),
    supabase
      .from("restaurants")
      .select("name, theme_json")
      .eq("id", ctx.restaurant.id)
      .single(),
  ]);
  if (!qr || !restaurant) return new Response("Not found.", { status: 404 });

  const url = qrPayloadUrl(qr.slug);
  const body =
    format.data === "svg"
      ? qrSvg(url, `${restaurant.name} menu`)
      : format.data === "png"
        ? await qrPng(url, 24)
        : await tableCardsPdf(
            url,
            {
              name: restaurant.name,
              line1: "Scan for our menu",
              line2: "Scannez pour voir le menu",
              footer: siteHost(),
            },
            readTheme(restaurant.theme_json).accent,
          );
  const base = `${
    restaurant.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "menu"
  }-qr`;
  const file =
    format.data === "pdf"
      ? `${base}-table-cards.pdf`
      : `${base}.${format.data}`;
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": TYPES[format.data],
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
