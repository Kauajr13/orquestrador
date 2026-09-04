import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Entrada por link mágico. Sem senha para guardar, sem senha para vazar — e o
 * painel tem um usuário só, então formulário de cadastro seria cerimônia vazia.
 */
async function enviarLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const permitidos = (process.env.EMAILS_PERMITIDOS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Some em silêncio com e-mail fora da lista: responder "não autorizado"
  // contaria a um estranho quais endereços existem aqui dentro.
  if (permitidos.length && !permitidos.includes(email)) return;

  const jar = await cookies();
  const cabecalhos = await headers();
  const host = cabecalhos.get("host");
  const protocolo = host?.startsWith("localhost") ? "http" : "https";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) jar.set(name, value, options);
          } catch {
            // server action fora de contexto de escrita
          }
        },
      },
    },
  );

  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${protocolo}://${host}/auth/confirmar` },
  });
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const enviado = "enviado" in params;

  return (
    <main className="flex-1 grid place-items-center p-6">
      <div className="janela w-full max-w-sm">
        <div className="janela-titulo">Entrada de funcionários</div>
        <form action={enviarLink} className="p-5 space-y-4">
          <p className="text-sm text-suave leading-snug">
            Este painel é interno. Só o chefe entra.
          </p>

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-widest text-apagado">E-mail</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full bg-fundo border-2 border-linha px-3 py-2 text-sm outline-none focus:border-ciano"
            />
          </label>

          <button
            type="submit"
            className="w-full border-2 border-fosforo text-fosforo px-3 py-2 text-sm uppercase tracking-widest hover:bg-fosforo hover:text-fundo transition-colors"
          >
            Receber link
          </button>

          {enviado ? (
            <p className="text-xs text-ciano">
              Se o endereço estiver na lista, o link chega em instantes.
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
