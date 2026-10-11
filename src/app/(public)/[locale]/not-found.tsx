import Link from "next/link";
import { getMessages } from "@/i18n/t";

// Locale isn't available to not-found boundaries; the copy is in English with the menu link.
export default function NotFound() {
  const m = getMessages("en");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">{m.notFoundTitle}</h1>
      <p className="text-muted-foreground">{m.notFoundBody}</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {m.fullMenu}
      </Link>
    </main>
  );
}
