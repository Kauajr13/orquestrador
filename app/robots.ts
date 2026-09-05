import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_URL_SITE ?? "https://example.com";

  return {
    rules: {
      userAgent: "*",
      allow: ["/site", "/privacidade"],
      // O painel é operação interna: fila de tarefas, folha de pagamento e log.
      // Nada disso deveria aparecer em busca.
      disallow: ["/", "/api/", "/login", "/auth", "/organograma", "/diario"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
