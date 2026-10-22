// Mirrors public.effective_availability(): a "sold out / limited until …" whose time has passed
// is available again, even before the hourly job clears the stored row. Staff screens use this
// so they always agree with what diners see.

type Row = {
  availability: "available" | "limited" | "unavailable";
  availability_note: string | null;
  remaining_qty: number | null;
  availability_until: string | null;
};

export function isExpired(row: Row, now = new Date()) {
  return (
    row.availability !== "available" &&
    row.availability_until !== null &&
    new Date(row.availability_until).getTime() <= now.getTime()
  );
}

export function withEffectiveAvailability<T extends Row>(
  row: T,
  now = new Date(),
): T {
  return isExpired(row, now)
    ? {
        ...row,
        availability: "available",
        availability_note: null,
        remaining_qty: null,
        availability_until: null,
      }
    : row;
}
