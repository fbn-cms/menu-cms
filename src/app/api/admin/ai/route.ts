import { z } from "zod";
import { AiQuotaError, describeDish, translateDish } from "@/lib/ai/menu-ai";
import { getStaffContext } from "@/lib/auth";

// POST /api/admin/ai — owner/admin only. Returns suggestions; never writes to the database.
const body = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("describe"),
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(500).default(""),
    options: z.array(z.string().trim().max(80)).max(20).default([]),
  }),
  z.object({
    task: z.literal("translate"),
    name: z.string().trim().min(1).max(120),
    short_description: z.string().trim().max(200).default(""),
    long_description: z.string().trim().max(4000).default(""),
    options: z.array(z.string().trim().max(80)).max(20).default([]),
  }),
]);

export async function POST(request: Request) {
  const ctx = await getStaffContext().catch(() => null);
  if (!ctx) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (ctx.profile.role === "staff")
    return Response.json({ error: "Not allowed." }, { status: 403 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Bad request." }, { status: 400 });
  const v = parsed.data;
  try {
    if (v.task === "describe") {
      return Response.json(
        await describeDish({ ...v, restaurant: ctx.restaurant.name }),
      );
    }
    return Response.json(await translateDish(v));
  } catch (e) {
    if (e instanceof AiQuotaError) {
      return Response.json(
        {
          error:
            "Today's free AI allowance is used up. It resets every day at midnight UTC (evening in Toronto).",
        },
        { status: 429 },
      );
    }
    return Response.json(
      {
        error: e instanceof Error ? e.message : "AI is unavailable right now.",
      },
      { status: 502 },
    );
  }
}
