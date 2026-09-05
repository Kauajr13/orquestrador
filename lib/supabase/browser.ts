import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente do navegador. Existe sobretudo pelo Realtime: o terminal e o
 * escritório assinam `logs`, `agentes` e `tarefas` e se atualizam sozinhos,
 * sem polling e sem recarregar a página.
 */
export function supabaseDoNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

/**
 * No modo demonstração não há credencial, e tentar abrir o canal derrubaria a
 * página inteira com um erro de client. A tela continua útil sem tempo real —
 * ela só deixa de se atualizar sozinha.
 */
export function temSupabaseNoNavegador(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
