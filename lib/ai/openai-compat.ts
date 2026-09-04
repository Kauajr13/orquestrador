import type { Mensagem, RespostaDoModelo } from "@/lib/tipos";
import { AIErro, type OpcoesDeConversa, type Provedor } from "./tipos";

/**
 * Cliente para qualquer provedor compatível com a API de chat da OpenAI. O b.ai
 * é um; trocar de provedor quando a promoção acabar é trocar baseUrl e modelo.
 *
 * Sem SDK de propósito: uma chamada de chat/completions com tool calling são
 * ~60 linhas de fetch, e a SDK traria dependência sem resolver nada que não
 * esteja resolvido aqui — inclusive porque a parte chata (retomar conversa
 * entre invocações serverless) nenhuma SDK resolve.
 */

export type ConfigCompat = {
  nome: string;
  baseUrl: string;
  apiKey: string;
  modelo: string;
  /** Preço por 1 milhão de tokens, em USD, a preço de mercado. */
  precoEntrada: number;
  precoSaida: number;
};

type RespostaBruta = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class ProvedorCompat implements Provedor {
  readonly nome: string;
  readonly modelo: string;

  constructor(private readonly cfg: ConfigCompat) {
    this.nome = cfg.nome;
    this.modelo = cfg.modelo;

    if (!cfg.apiKey) throw new AIErro(`${cfg.nome}: API key ausente`, 401, cfg.nome);
    if (!cfg.modelo) throw new AIErro(`${cfg.nome}: modelo vazio`, 400, cfg.nome);
  }

  async conversar(
    mensagens: Mensagem[],
    opcoes: OpcoesDeConversa = {},
  ): Promise<RespostaDoModelo> {
    const url = `${this.cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const corpo: Record<string, unknown> = {
      model: this.cfg.modelo,
      messages: mensagens,
      max_tokens: opcoes.maxTokens ?? 4096,
    };
    if (opcoes.temperatura !== undefined) corpo.temperature = opcoes.temperatura;
    if (opcoes.ferramentas?.length) {
      corpo.tools = opcoes.ferramentas;
      corpo.tool_choice = "auto";
    }

    let r: Response;
    try {
      r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(corpo),
        // Um tick inteiro tem 60s. Se o provedor não respondeu em 45, o resto
        // do passo não caberia mesmo — melhor abortar e deixar o próximo tick
        // retomar do estado salvo do que morrer no meio da escrita.
        signal: AbortSignal.timeout(45_000),
      });
    } catch (e) {
      const erro = e as Error;
      const timeout = erro.name === "TimeoutError" || erro.name === "AbortError";
      throw new AIErro(
        `${this.nome}: ${timeout ? "tempo esgotado (45s)" : erro.message}`,
        timeout ? 504 : 503,
        this.nome,
      );
    }

    const texto = await r.text();

    if (!r.ok) {
      throw new AIErro(
        `${this.nome} HTTP ${r.status}: ${texto.slice(0, 300)}`,
        r.status,
        this.nome,
      );
    }

    let dados: RespostaBruta;
    try {
      dados = JSON.parse(texto);
    } catch {
      throw new AIErro(`${this.nome}: resposta não é JSON`, 502, this.nome);
    }

    const escolha = dados.choices?.[0];
    if (!escolha) throw new AIErro(`${this.nome}: resposta sem choices`, 502, this.nome);

    const chamadas = escolha.message?.tool_calls ?? [];
    const conteudo = escolha.message?.content ?? null;

    // Um turno sem texto e sem ferramenta é resposta vazia — não dá pra seguir.
    if (conteudo === null && chamadas.length === 0) {
      throw new AIErro(`${this.nome}: turno vazio`, 502, this.nome);
    }

    return {
      conteudo,
      chamadas,
      tokensEntrada: dados.usage?.prompt_tokens ?? 0,
      tokensSaida: dados.usage?.completion_tokens ?? 0,
      modelo: this.cfg.modelo,
      // Sem tool_calls, o agente terminou o que tinha a dizer neste turno.
      parou: chamadas.length === 0,
    };
  }

  /** Custo a preço de mercado, mesmo enquanto o provedor está de graça. */
  custo(tokensEntrada: number, tokensSaida: number): number {
    return (
      (tokensEntrada / 1_000_000) * this.cfg.precoEntrada +
      (tokensSaida / 1_000_000) * this.cfg.precoSaida
    );
  }
}
