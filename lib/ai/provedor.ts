import { ProvedorCompat } from "./openai-compat";
import { AIErro } from "./tipos";

/**
 * Qual LLM a empresa usa hoje.
 *
 * Nada aqui é fixo de propósito: o provedor é escolhido por variável de
 * ambiente. Isso já provou o valor — o projeto nasceu apontando para o b.ai,
 * que encerrou a promoção de tokens gratuitos poucos dias depois, e trocar foi
 * mexer em três linhas do `.env` em vez de refazer a camada.
 *
 * Só há dois requisitos para o provedor entrar aqui:
 *   1. falar `/chat/completions` no formato da OpenAI
 *   2. suportar tool calling — sem isso o runner não existe, porque o agente
 *      não teria como pedir para usar uma ferramenta
 *
 * Atendem hoje: Mistral, Gemini (endpoint compatível), Groq, DeepSeek,
 * OpenRouter, Together, e a própria OpenAI.
 */

/**
 * Trabalho barato (classificar, resumir, escrever texto) vai no modelo pequeno;
 * código e decisão estratégica vão no grande. O hábito precisa existir desde o
 * começo: quando o volume crescer, mudar o roteamento é trocar uma env var em
 * vez de refazer a arquitetura.
 */
export type TipoDeTrabalho = "barato" | "caro";

/**
 * Preço de mercado por 1 milhão de tokens, em USD, por prefixo de modelo.
 * Serve para estimar ordem de grandeza, não para faturar: o objetivo é o Kauã
 * ver a projeção mensal antes de a conta existir de verdade.
 */
const PRECOS: Array<{ prefixo: string; entrada: number; saida: number }> = [
  { prefixo: "claude-opus", entrada: 15, saida: 75 },
  { prefixo: "claude-sonnet", entrada: 3, saida: 15 },
  { prefixo: "claude-haiku", entrada: 0.8, saida: 4 },
  { prefixo: "gpt-5", entrada: 1.25, saida: 10 },
  { prefixo: "gpt-4", entrada: 2.5, saida: 10 },
  { prefixo: "gemini", entrada: 1.25, saida: 5 },
  { prefixo: "mistral-large", entrada: 2, saida: 6 },
  { prefixo: "mistral-medium", entrada: 0.4, saida: 2 },
  { prefixo: "mistral-small", entrada: 0.2, saida: 0.6 },
  { prefixo: "codestral", entrada: 0.3, saida: 0.9 },
  { prefixo: "deepseek", entrada: 0.28, saida: 0.42 },
  { prefixo: "llama", entrada: 0.6, saida: 0.8 },
  { prefixo: "gpt-oss-120b", entrada: 0.15, saida: 0.6 },
  { prefixo: "gpt-oss-20b", entrada: 0.075, saida: 0.3 },
  { prefixo: "qwen", entrada: 0.4, saida: 1.2 },
];

// Modelo desconhecido cai aqui. Preferimos superestimar: uma projeção alta
// demais faz o Kauã olhar; uma baixa demais faz ele não olhar.
const PRECO_PADRAO = { entrada: 3, saida: 15 };

function precoDe(modelo: string) {
  const m = modelo.toLowerCase();
  return PRECOS.find((p) => m.includes(p.prefixo)) ?? PRECO_PADRAO;
}

/** Nome amigável do provedor, tirado da URL — só para log e mensagem de erro. */
function nomeDoProvedor(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.replace(/^api\./, "").replace(/\.com$|\.ai$/, "");
  } catch {
    return "llm";
  }
}

/**
 * A fila de modelos para um tipo de trabalho.
 *
 * As variáveis aceitam uma lista separada por vírgula, e não um modelo só,
 * porque free tier costuma limitar por modelo e por dia — no Gemini são cerca
 * de 20 requisições diárias para cada um. Um modelo sozinho não sustenta nem
 * uma tarefa; quatro deles somados sustentam o dia de trabalho de uma empresa
 * pequena. Quando um esgota, o `conversar()` passa para o próximo da fila.
 *
 * Com provedor pago isso não atrapalha: basta listar um modelo só.
 */
export function provedoresPara(tipo: TipoDeTrabalho, modeloForcado?: string | null) {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY ?? "";

  if (!baseUrl) {
    throw new AIErro(
      "Defina LLM_BASE_URL (ex.: https://generativelanguage.googleapis.com/v1beta/openai)",
      400,
      "llm",
    );
  }

  const nome = nomeDoProvedor(baseUrl);
  if (!apiKey) throw new AIErro("LLM_API_KEY ausente no ambiente", 401, nome);

  const bruto =
    modeloForcado ||
    (tipo === "caro"
      ? process.env.LLM_MODELO_CARO
      : process.env.LLM_MODELO_BARATO ?? process.env.LLM_MODELO_CARO);

  if (!bruto) {
    throw new AIErro(
      "Defina LLM_MODELO_CARO (e de preferência LLM_MODELO_BARATO) no ambiente",
      400,
      nome,
    );
  }

  const modelos = bruto
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return modelos.map((modelo) => {
    const preco = precoDe(modelo);
    return new ProvedorCompat({
      nome,
      baseUrl,
      apiKey,
      modelo,
      precoEntrada: preco.entrada,
      precoSaida: preco.saida,
    });
  });
}

/** Compatibilidade: o primeiro da fila. */
export function provedorPara(tipo: TipoDeTrabalho, modeloForcado?: string | null) {
  return provedoresPara(tipo, modeloForcado)[0];
}
