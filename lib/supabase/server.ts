import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente ligado à sessão de quem está olhando o painel. É ele que o app usa —
 * nunca a service_role.
 *
 * Motivo: a service_role IGNORA RLS. Com ela, um erro de query meu devolve linha
 * que não deveria e o banco não reclama. Com o JWT da sessão, o Postgres recusa.
 */
export async function supabaseDaSessao(): Promise<SupabaseClient> {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // O timer de refresh do GoTrueClient dispara depois que a função
        // serverless congela e volta como unhandled rejection ("Invalid Refresh
        // Token"). Quem renova a sessão aqui é o proxy, a cada request.
        autoRefreshToken: false,
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) jar.set(name, value, options);
          } catch {
            // chamado de Server Component: o proxy já renovou a sessão
          }
        },
      },
    },
  );
}

export async function usuarioAtual() {
  const { data } = await (await supabaseDaSessao()).auth.getUser();
  return data.user;
}

/**
 * O painel é interno. Só o e-mail do chefe entra — a empresa é autônoma, mas a
 * plateia não é aberta.
 */
export function emailPermitido(email: string | null | undefined): boolean {
  if (!email) return false;
  const lista = (process.env.EMAILS_PERMITIDOS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
