import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CategoryForm, type CategoryFormValue } from "./category-form";

export const metadata: Metadata = { title: "Edit category" };

export default async function CategoryEditPage({
  params,
}: PageProps<"/admin/categories/[id]">) {
  await requireRole("owner", "admin");
  const { id } = await params;

  if (id === "new") {
    const blank: CategoryFormValue = {
      id: crypto.randomUUID(),
      expectedUpdatedAt: null,
      name: "",
      slug: "",
      description: "",
      isPublished: true,
      translations: {
        fa: { name: "", description: "" },
        fr: { name: "", description: "" },
      },
    };
    return <CategoryForm initial={blank} isNew itemCount={0} />;
  }

  const supabase = await createSupabaseServer();
  const [{ data: c }, { data: tr }, { count }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, is_published, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("category_translations")
      .select("locale, name, description")
      .eq("category_id", id),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id),
  ]);
  if (!c) notFound();
  const t = (l: "fa" | "fr") => tr?.find((x) => x.locale === l);
  const value: CategoryFormValue = {
    id: c.id,
    expectedUpdatedAt: c.updated_at,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    isPublished: c.is_published,
    translations: {
      fa: {
        name: t("fa")?.name ?? "",
        description: t("fa")?.description ?? "",
      },
      fr: {
        name: t("fr")?.name ?? "",
        description: t("fr")?.description ?? "",
      },
    },
  };
  return <CategoryForm initial={value} isNew={false} itemCount={count ?? 0} />;
}
