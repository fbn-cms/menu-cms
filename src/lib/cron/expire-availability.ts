// Hourly: put back on sale every dish whose "sold out / limited until …" time has passed
// (end of service, 07:00 reset, …). Diners already see those as available (the menu reads
// effective_availability); this clears the stored flag so staff screens and live updates agree.
// No Next.js imports: runs from the Worker's scheduled() handler.

export async function expireAvailability(
  supabaseUrl: string,
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const res = await fetchImpl(
    new URL("/rest/v1/rpc/expire_availability", supabaseUrl),
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!res.ok)
    throw new Error(`expire_availability: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length;
}
