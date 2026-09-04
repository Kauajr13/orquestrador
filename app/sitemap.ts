import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * O sitemap sai do banco, não de arquivos.
 *
 * É o que torna SEO programático possível aqui: quando um agente publica uma
 * página, ela entra no sitemap no mesmo instante, sem build e sem deploy.
 * O painel interno fica de fora — ninguém precisa indexar a folha de pagamento.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_URL_SITE ?? "https://example.com";

  const fixas: MetadataRoute.Sitemap = [
    { url: `${base}/site`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return fixas;

  try {
    const { data } = await supabaseAdmin()
      .from("paginas")
      .select("slug, atualizado_em")
      .eq("publicada", true)
      .limit(1000);

    return [
      ...fixas,
      ...(data ?? []).map((p) => ({
        url: `${base}/site/${p.slug}`,
        lastModified: new Date(p.atualizado_em as string),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return fixas;
  }
}
