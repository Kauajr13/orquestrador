import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão a cada request e barra o painel para quem não é o chefe.
 *
 * No Next 16 este arquivo se chama `proxy.ts` — era `middleware.ts` antes.
 *
 * Importante: isto não é a proteção dos dados, é a proteção da tela. Quem
 * garante que ninguém lê linha alheia é o RLS no Postgres; se este arquivo
 * sumisse, o banco continuaria recusando. É assim que tem que ser.
 */

const PUBLICAS = ["/login", "/auth", "/site", "/privacidade", "/termos", "/sitemap.xml", "/robots.txt"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Sem credencial o painel roda em modo demonstração, com dados de mentira.
  // Bloquear aqui só esconderia a interface de quem está construindo ela.
  if (!url || !anon) return NextResponse.next();

  const caminho = request.nextUrl.pathname;
  if (PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida o token no servidor. getSession() só lê o cookie, que dá
  // para forjar — a diferença importa exatamente aqui.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const permitidos = (process.env.EMAILS_PERMITIDOS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const autorizado =
    user && (permitidos.length === 0 || permitidos.includes((user.email ?? "").toLowerCase()));

  if (!autorizado) {
    if (caminho.startsWith("/api/")) {
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    // O cron autentica por CRON_SECRET, não por sessão: ele não tem navegador.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/telegram|.*\\.(?:png|svg|ico|webp|woff2?)$).*)",
  ],
};
