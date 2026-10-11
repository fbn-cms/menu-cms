export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="bg-background w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function FormMessage({
  state,
}: {
  state: { error?: string; message?: string };
}) {
  if (state.error)
    return (
      <p role="alert" className="text-destructive text-sm">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}
