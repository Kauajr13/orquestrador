import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com service_role. Ignora RLS, então só o runner usa — é ele que
 * escreve por conta dos agentes, e agente não tem sessão de usuário.
 *
 * Nunca importe isto de um componente. Se precisar ler dado no painel, use
 * `supabaseDaSessao()`: o painel é do chefe, não do sistema.
 */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;

  if (!url || !chave) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no ambiente.",
    );
  }

  return createClient(url, chave, {
    auth: {
      // Sem sessão nem timer: isto roda em função serverless, que congela.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
