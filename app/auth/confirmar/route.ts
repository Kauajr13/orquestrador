import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Onde o link mágico cai. Troca o token de uso único por uma sessão. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tipo = request.nextUrl.searchParams.get("type");

  const destino = request.nextUrl.clone();
  destino.searchParams.delete("token_hash");
  destino.searchParams.delete("type");

  if (!tokenHash || tipo !== "email") {
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const jar = await cookies();
  let resposta = NextResponse.redirect(new URL("/", request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista) => {
          for (const { name, value, options } of lista) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });

  if (error) {
    destino.pathname = "/login";
    resposta = NextResponse.redirect(destino);
  }

  return resposta;
}
