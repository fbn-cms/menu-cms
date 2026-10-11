// Human-readable one-liner for an audit_log row (dashboard + audit page).
export function describeAudit(r: {
  action: string;
  entity: string;
  after_json: unknown;
  before_json: unknown;
}) {
  const row = (r.after_json ?? r.before_json ?? {}) as Record<string, unknown>;
  const name = (row.name ??
    row.full_name ??
    row.email ??
    row.label ??
    "") as string;
  if (r.action === "availability") {
    const state =
      { available: "Available", limited: "Limited", unavailable: "Sold out" }[
        String(row.availability)
      ] ?? "";
    return `${name} → ${state}`;
  }
  return `${r.action[0]?.toUpperCase()}${r.action.slice(1)} ${r.entity.replace(/_/g, " ").replace(/s$/, "")}${name ? `: ${name}` : ""}`;
}
