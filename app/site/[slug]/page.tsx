import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/lib/markdown";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Pagina } from "@/lib/tipos";

export const dynamic = "force-dynamic";

async function buscar(slug: string): Promise<Pagina | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const { data } = await supabaseAdmin()
      .from("paginas")
      .select("*")
      .eq("slug", slug)
      .eq("publicada", true)
      .maybeSingle();
    return (data as Pagina) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/site/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pagina = await buscar(slug);
  if (!pagina) return { title: "Página não encontrada" };
  return { title: pagina.titulo, description: pagina.resumo };
}

export default async function PaginaPublica({ params }: PageProps<"/site/[slug]">) {
  const { slug } = await params;
  const pagina = await buscar(slug);
  if (!pagina) notFound();

  return (
    <article>
      <h1 className="text-2xl leading-tight mb-2">{pagina.titulo}</h1>
      {pagina.resumo ? (
        <p className="text-suave mb-6 leading-relaxed">{pagina.resumo}</p>
      ) : null}

      <div className="text-[15px]">
        <Markdown texto={pagina.conteudo} />
      </div>

      {pagina.fontes.length ? (
        <section className="mt-10 pt-4 border-t-2 border-linha">
          <h2 className="text-xs uppercase tracking-widest text-apagado mb-2">Fontes</h2>
          <ul className="space-y-1">
            {pagina.fontes.map((f) => (
              <li key={f} className="text-xs break-all">
                <a
                  href={f}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="text-ciano underline underline-offset-2"
                >
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
