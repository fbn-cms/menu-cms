import { z } from "zod";
import { loadAiConfig } from "@/lib/ai/config";
import { AiError, composeDish } from "@/lib/ai/menu-ai";
import { getStaffContext } from "@/lib/auth";

// POST /api/admin/ai — owner/admin only. Returns suggestions; never writes to the database.
const body = z.object({
  source: z.enum(["en", "fa", "fr"]),
  name: z.string().trim().min(1).max(120),
  short_description: z.string().trim().max(200).default(""),
  long_description: z.string().trim().max(4000).default(""),
  notes: z.string().trim().max(500).default(""),
  options: z.array(z.string().trim().max(80)).max(20).default([]),
  category: z.string().trim().max(80).default(""),
});

export async function POST(request: Request) {
  const ctx = await getStaffContext().catch(() => null);
  if (!ctx) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (ctx.profile.role === "staff")
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Type a dish name first." }, { status: 400 });
  try {
    const cfg = await loadAiConfig(ctx.restaurant.id);
    const result = await composeDish(
      { ...parsed.data, restaurant: ctx.restaurant.name },
      cfg,
    );
    return Response.json({ result, provider: cfg.provider, model: cfg.model });
  } catch (e) {
    if (e instanceof AiError)
      return Response.json({ error: e.message }, { status: e.status });
    console.error("[ai] route failed", e);
    return Response.json(
      {
        error: "AI is unavailable right now. Try again, or write it yourself.",
      },
      { status: 502 },
    );
  }
}
