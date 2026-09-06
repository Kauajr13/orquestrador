import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Entrada do escritório.
 *
 * Senha é o caminho principal, porque é o que o chefe usa no dia a dia. O link
 * mágico fica como saída de emergência para quando a senha se perder — sem
 * senha guardada em lugar nenhum, ele nunca deixa de funcionar.
 */

async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) jar.set(name, value, options);
          } catch {
            // fora de contexto de escrita; o proxy renova na próxima requisição
          }
        },
      },
    },
  );
}

function permitido(email: string): boolean {
  const lista = (process.env.EMAILS_PERMITIDOS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.length === 0 || lista.includes(email.toLowerCase());
}

async function entrarComSenha(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) redirect("/login?erro=1");

  // E-mail fora da lista falha igual a senha errada, e de propósito: a
  // mensagem não deve contar a um estranho quais endereços existem aqui.
  if (!permitido(email)) redirect("/login?erro=1");

  const { error } = await (await supabase()).auth.signInWithPassword({ email, password: senha });
  if (error) redirect("/login?erro=1");

  redirect("/");
}

async function enviarLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !permitido(email)) redirect("/login?enviado=1");

  const cabecalhos = await headers();
  const host = cabecalhos.get("host");
  const protocolo = host?.startsWith("localhost") ? "http" : "https";

  await (await supabase()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${protocolo}://${host}/auth/confirmar` },
  });

  redirect("/login?enviado=1");
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const erro = "erro" in params;
  const enviado = "enviado" in params;

  return (
    <main className="flex-1 grid place-items-center p-6">
      <div className="janela w-full max-w-sm">
        <div className="janela-titulo">Entrada de funcionários</div>

        <form action={entrarComSenha} className="p-5 space-y-4">
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

          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-widest text-apagado">Senha</span>
            <input
              type="password"
              name="senha"
              required
              autoComplete="current-password"
              className="w-full bg-fundo border-2 border-linha px-3 py-2 text-sm outline-none focus:border-ciano"
            />
          </label>

          <button
            type="submit"
            className="w-full border-2 border-fosforo text-fosforo px-3 py-2 text-sm uppercase tracking-widest hover:bg-fosforo hover:text-fundo transition-colors"
          >
            Entrar
          </button>

          {erro ? <p className="text-xs text-vermelho">E-mail ou senha não confere.</p> : null}
        </form>

        <form action={enviarLink} className="px-5 pb-5 -mt-1">
          <button
            type="submit"
            formNoValidate
            className="text-xs text-apagado underline underline-offset-2 hover:text-ciano"
          >
            Esqueci a senha — me mande um link por e-mail
          </button>
          {enviado ? (
            <p className="text-xs text-ciano mt-2">
              Se o endereço estiver na lista, o link chega em instantes.
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
