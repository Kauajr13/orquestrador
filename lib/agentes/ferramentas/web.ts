import { envelopeNaoConfiavel } from "../prompt-base";
import type { Ferramenta } from "./tipos";

/**
 * Os olhos da empresa. Tudo que sai daqui volta envelopado como conteúdo
 * externo — regra 8 da constituição —, porque uma página pode conter texto
 * escrito para manipular quem a lê, e quem a lê aqui é um agente com poder de
 * abrir PR e contratar gente.
 */

const TAVILY = "https://api.tavily.com/search";

export const buscarWeb: Ferramenta = {
  nome: "buscar_web",
  descricao:
    "Busca na internet e devolve resultados com título, URL e um resumo. Use para pesquisar mercado, concorrentes, preços e tendências.",
  parametros: {
    type: "object",
    properties: {
      consulta: { type: "string", description: "O que procurar, em linguagem natural" },
      quantidade: {
        type: "number",
        description: "Quantos resultados (1 a 10, padrão 5)",
      },
    },
    required: ["consulta"],
  },

  async executar(args, ctx) {
    const chave = process.env.TAVILY_API_KEY;
    if (!chave) throw new Error("TAVILY_API_KEY não está configurada no ambiente");

    const consulta = String(args.consulta ?? "").trim();
    if (!consulta) throw new Error("consulta vazia");

    const quantidade = Math.min(Math.max(Number(args.quantidade) || 5, 1), 10);

    const r = await fetch(TAVILY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        query: consulta,
        max_results: quantidade,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!r.ok) {
      throw new Error(`busca falhou (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
    }

    const dados = (await r.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const achados = dados.results ?? [];
    if (!achados.length) return "Nenhum resultado.";

    for (const a of achados) {
      if (a.url && a.content) ctx.fontesLidas.push({ url: a.url, texto: a.content });
    }

    const texto = achados
      .map((a, i) => `${i + 1}. ${a.title ?? "sem título"}\n   ${a.url}\n   ${a.content ?? ""}`)
      .join("\n\n");

    return envelopeNaoConfiavel(`busca: ${consulta}`, texto);
  },
};

export const lerPagina: Ferramenta = {
  nome: "ler_pagina",
  descricao:
    "Baixa uma página da web e devolve o texto dela. Use quando um resultado de busca merecer leitura completa.",
  parametros: {
    type: "object",
    properties: {
      url: { type: "string", description: "Endereço completo, com https://" },
    },
    required: ["url"],
  },

  async executar(args, ctx) {
    const bruto = String(args.url ?? "").trim();

    let url: URL;
    try {
      url = new URL(bruto);
    } catch {
      throw new Error(`URL inválida: ${bruto}`);
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("só http e https");
    }

    // Rede interna e metadata de nuvem ficam fora do alcance. Um agente que lê
    // uma página controlada por terceiro não pode ser induzido a buscar
    // 169.254.169.254 e trazer credencial de volta.
    if (enderecoInterno(url.hostname)) {
      throw new Error("endereço de rede interna não é acessível");
    }

    const r = await fetch(url, {
      headers: { "User-Agent": "orquestrador/0.1 (+leitura para pesquisa)" },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });

    if (!r.ok) throw new Error(`a página respondeu HTTP ${r.status}`);

    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("html") && !tipo.includes("text")) {
      throw new Error(`conteúdo não é texto (${tipo})`);
    }

    const html = await r.text();
    const texto = extrairTexto(html).slice(0, 20_000);

    ctx.fontesLidas.push({ url: url.href, texto });

    return envelopeNaoConfiavel(url.href, texto);
  },
};

function enderecoInterno(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "169.254.169.254" ||
    h === "[::1]"
  );
}

/** Extração simples e sem dependência: o modelo lê bem texto imperfeito. */
function extrairTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
