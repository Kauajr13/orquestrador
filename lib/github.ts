/**
 * A mão do Dev no repositório.
 *
 * O token é fine-grained e alcança um único repositório — regra 7 da
 * constituição. Não é uma promessa no prompt: se um agente tentar tocar outro
 * repo, o GitHub devolve 404 e acabou.
 *
 * Commits saem pela Git Data API, e não pela API de conteúdo, porque um PR
 * costuma mexer em vários arquivos e precisa ser um commit só. Meio commit é
 * pior que commit nenhum.
 */

const API = "https://api.github.com";

type Arquivo = { caminho: string; conteudo: string };

function repo(): string {
  const r = process.env.GITHUB_REPO;
  if (!r || !r.includes("/")) {
    throw new Error("GITHUB_REPO ausente ou fora do formato dono/repositorio");
  }
  return r;
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN ausente no ambiente");

  const r = await fetch(`${API}${caminho}`, {
    method: opcoes.metodo ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  const texto = await r.text();

  if (!r.ok) {
    // 404 num token fine-grained quase sempre quer dizer "fora do escopo",
    // não "não existe". Vale dizer isso, senão o agente fica tentando de novo.
    const dica =
      r.status === 404
        ? " (404 aqui costuma ser falta de permissão: o token só alcança o repositório da empresa)"
        : "";
    throw new Error(`GitHub HTTP ${r.status}${dica}: ${texto.slice(0, 300)}`);
  }

  return texto ? (JSON.parse(texto) as T) : ({} as T);
}

export async function ramoPadrao(): Promise<string> {
  const dados = await chamar<{ default_branch: string }>(`/repos/${repo()}`);
  return dados.default_branch;
}

/** Cria um branch a partir da ponta do ramo padrão. */
export async function criarBranch(nome: string): Promise<string> {
  const base = await ramoPadrao();
  const ref = await chamar<{ object: { sha: string } }>(
    `/repos/${repo()}/git/ref/heads/${base}`,
  );
  const sha = ref.object.sha;

  await chamar(`/repos/${repo()}/git/refs`, {
    metodo: "POST",
    corpo: { ref: `refs/heads/${nome}`, sha },
  });

  return sha;
}

/** Um commit com todos os arquivos de uma vez. */
export async function commitar(
  branch: string,
  shaBase: string,
  arquivos: Arquivo[],
  mensagem: string,
): Promise<string> {
  const commitBase = await chamar<{ tree: { sha: string } }>(
    `/repos/${repo()}/git/commits/${shaBase}`,
  );

  const tree = await chamar<{ sha: string }>(`/repos/${repo()}/git/trees`, {
    metodo: "POST",
    corpo: {
      base_tree: commitBase.tree.sha,
      tree: arquivos.map((a) => ({
        path: a.caminho,
        mode: "100644",
        type: "blob",
        content: a.conteudo,
      })),
    },
  });

  const commit = await chamar<{ sha: string }>(`/repos/${repo()}/git/commits`, {
    metodo: "POST",
    corpo: { message: mensagem, tree: tree.sha, parents: [shaBase] },
  });

  await chamar(`/repos/${repo()}/git/refs/heads/${branch}`, {
    metodo: "PATCH",
    corpo: { sha: commit.sha },
  });

  return commit.sha;
}

export async function abrirPR(
  branch: string,
  titulo: string,
  corpo: string,
): Promise<{ numero: number; url: string }> {
  const base = await ramoPadrao();
  const pr = await chamar<{ number: number; html_url: string }>(
    `/repos/${repo()}/pulls`,
    { metodo: "POST", corpo: { title: titulo, body: corpo, head: branch, base } },
  );
  return { numero: pr.number, url: pr.html_url };
}

export async function verPR(numero: number) {
  return chamar<{
    number: number;
    title: string;
    body: string;
    head: { sha: string; ref: string };
    mergeable: boolean | null;
    merged: boolean;
    state: string;
    changed_files: number;
  }>(`/repos/${repo()}/pulls/${numero}`);
}

export async function diffDoPR(numero: number): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const r = await fetch(`${API}/repos/${repo()}/pulls/${numero}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.diff",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`não consegui ler o diff (HTTP ${r.status})`);
  return r.text();
}

export async function arquivosDoPR(numero: number): Promise<string[]> {
  const lista = await chamar<Array<{ filename: string }>>(
    `/repos/${repo()}/pulls/${numero}/files?per_page=100`,
  );
  return lista.map((a) => a.filename);
}

/** Verde, vermelho ou ainda rodando. */
export async function estadoDoCI(sha: string): Promise<"sucesso" | "falhou" | "rodando"> {
  const dados = await chamar<{
    check_runs: Array<{ status: string; conclusion: string | null }>;
  }>(`/repos/${repo()}/commits/${sha}/check-runs`);

  const rodadas = dados.check_runs ?? [];
  if (!rodadas.length) return "rodando";
  if (rodadas.some((c) => c.status !== "completed")) return "rodando";
  return rodadas.every((c) => c.conclusion === "success" || c.conclusion === "neutral")
    ? "sucesso"
    : "falhou";
}

/**
 * URL do preview da Vercel para um commit. A Vercel publica isso como
 * deployment status no próprio GitHub, então dá pra ler sem tocar na API dela.
 *
 * Serve para o Revisor não julgar só o diff: código gerado por modelo compila
 * bem e quebra em runtime com frequência, e abrir a página é o jeito barato de
 * pegar essa classe inteira de erro.
 */
export async function urlDePreview(sha: string): Promise<string | null> {
  const statuses = await chamar<
    Array<{ state: string; target_url: string | null; context: string }>
  >(`/repos/${repo()}/commits/${sha}/statuses`).catch(() => []);

  const vercel = statuses.find(
    (s) => s.context.toLowerCase().includes("vercel") && s.state === "success",
  );
  return vercel?.target_url ?? null;
}

/**
 * O preview responde? Não interessa o conteúdo, interessa não estar quebrado.
 *
 * Três respostas possíveis, e a do meio é a que evita um estrago: quando a
 * proteção de deployment da Vercel está ligada, todo preview devolve redirect
 * para o login. Tratar isso como "não carrega" faria o Revisor reprovar todos
 * os PRs por um motivo que não tem nada a ver com o código — e o mais grave é
 * que pareceria um problema real do PR.
 */
export async function previewResponde(
  url: string,
): Promise<{ estado: "ok" | "protegido" | "quebrado"; status: number | null }> {
  try {
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    if (r.status >= 300 && r.status < 400) {
      const destino = r.headers.get("location") ?? "";
      if (/vercel\.com\/(sso|login)|\/\.well-known\/vercel/.test(destino)) {
        return { estado: "protegido", status: r.status };
      }
      // Redirect da própria aplicação (o painel manda para /login) é sinal de
      // que ela está de pé e respondendo.
      return { estado: "ok", status: r.status };
    }

    if (r.status === 401 || r.status === 403) return { estado: "protegido", status: r.status };

    return { estado: r.ok ? "ok" : "quebrado", status: r.status };
  } catch {
    return { estado: "quebrado", status: null };
  }
}

export async function comentarNoPR(numero: number, texto: string): Promise<void> {
  await chamar(`/repos/${repo()}/issues/${numero}/comments`, {
    metodo: "POST",
    corpo: { body: texto },
  });
}

export async function mergear(numero: number, titulo: string): Promise<void> {
  await chamar(`/repos/${repo()}/pulls/${numero}/merge`, {
    metodo: "PUT",
    corpo: { commit_title: titulo, merge_method: "squash" },
  });
}

/**
 * Caminhos que mexem na espinha dorsal. O Kauã escolheu merge automático sem
 * exceção, então isto NÃO bloqueia — só avisa, para ele saber que a estrutura
 * mudou. A exceção é `supabase/`, essa sim trava: é o único erro sem volta.
 */
export const CAMINHOS_SENSIVEIS = [
  "lib/agentes/",
  ".github/",
  "vercel.json",
  "CONSTITUICAO.md",
  "testes/constituicao.test.ts",
];

export function tocaMigration(arquivos: string[]): boolean {
  return arquivos.some((a) => a.startsWith("supabase/"));
}

export function tocaEspinhaDorsal(arquivos: string[]): string[] {
  return arquivos.filter((a) => CAMINHOS_SENSIVEIS.some((c) => a.startsWith(c)));
}
