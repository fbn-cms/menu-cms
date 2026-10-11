import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

// Target of every auth email (invite, magic link, password reset). The email templates link
// here with a token_hash, which works on any device (unlike PKCE codes).
const TYPES = new Set<EmailOtpType>([
  "invite",
  "magiclink",
  "email",
  "recovery",
  "signup",
  "email_change",
]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", url.origin));
}
