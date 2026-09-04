import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do navegador. Existe sobretudo pelo Realtime: o terminal e o
 * escritório assinam `logs`, `agentes` e `tarefas` e se atualizam sozinhos,
 * sem polling e sem recarregar a página.
 */
export function supabaseDoNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
