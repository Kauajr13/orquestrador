import { ProvedorCompat } from "./openai-compat";
import { AIErro } from "./tipos";

/**
 * Quais LLMs a empresa usa, e em que ordem.
 *
 * A empresa fala com vários provedores, e a ordem importa: o primeiro da fila é
 * o mais barato, e os seguintes só entram quando o anterior recusa por cota.
 * Na prática isso significa trabalhar de graça enquanto der e pagar só o
 * excedente — o provedor gratuito cobre o dia normal, e o pago existe para a
 * empresa não parar quando ele esgota.
 *
 * Nada aqui é fixo de propósito, e isso já se pagou duas vezes: o projeto
 * nasceu no b.ai, que encerrou a promoção em dias, e depois no Groq, cujo plano
 * pago fechou por demanda. Trocar de provedor é mexer no `.env`.
 *
 * Dois requisitos para entrar na fila:
 *   1. falar `/chat/completions` no formato da OpenAI
 *   2. suportar tool calling — sem isso o runner não existe
 *
 * Configuração, numerada a partir de 1 e lida até faltar uma:
 *
 *   LLM_1_URL=https://api.groq.com/openai/v1
 *   LLM_1_KEY=gsk_...
 *   LLM_1_MODELOS_CARO=openai/gpt-oss-120b,qwen/qwen3.8-27b
 *   LLM_1_MODELOS_BARATO=openai/gpt-oss-20b
 *   LLM_2_URL=https://api.deepseek.com/v1
 *   LLM_2_KEY=sk-...
 *   LLM_2_MODELOS_CARO=deepseek-chat
 *
 * O formato antigo de um provedor só (LLM_BASE_URL / LLM_API_KEY /
 * LLM_MODELO_CARO / LLM_MODELO_BARATO) continua funcionando como provedor 1.
 */

export type TipoDeTrabalho = "barato" | "caro";

/**
 * Preço de mercado por 1 milhão de tokens, em USD, por prefixo de modelo.
 * Serve para estimar ordem de grandeza e alimentar o freio de gasto, não para
 * faturar.
 */
const PRECOS: Array<{ prefixo: string; entrada: number; saida: number }> = [
  { prefixo: "claude-opus", entrada: 15, saida: 75 },
  { prefixo: "claude-sonnet", entrada: 3, saida: 15 },
  { prefixo: "claude-haiku", entrada: 0.8, saida: 4 },
  { prefixo: "gpt-5", entrada: 1.25, saida: 10 },
  { prefixo: "gpt-4", entrada: 2.5, saida: 10 },
  { prefixo: "gemini", entrada: 1.25, saida: 5 },
  { prefixo: "mistral-large", entrada: 2, saida: 6 },
  { prefixo: "mistral-small", entrada: 0.2, saida: 0.6 },
  { prefixo: "codestral", entrada: 0.3, saida: 0.9 },
  // DeepSeek V4-Flash. O cache derruba a entrada para US$ 0,007, mas aqui fica
  // o preço cheio: superestimar faz o freio de gasto proteger mais, não menos.
  { prefixo: "deepseek", entrada: 0.22, saida: 0.66 },
  { prefixo: "gpt-oss-120b", entrada: 0.15, saida: 0.6 },
  { prefixo: "gpt-oss-20b", entrada: 0.075, saida: 0.3 },
  { prefixo: "llama", entrada: 0.6, saida: 0.8 },
  { prefixo: "qwen", entrada: 0.4, saida: 1.2 },
];

const PRECO_PADRAO = { entrada: 3, saida: 15 };

function precoDe(modelo: string) {
  const m = modelo.toLowerCase();
  return PRECOS.find((p) => m.includes(p.prefixo)) ?? PRECO_PADRAO;
}

/** Nome curto do provedor, tirado da URL — para log e mensagem de erro. */
function nomeDoProvedor(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname.replace(/^api\./, "").replace(/\.(com|ai|net)$/, "");
  } catch {
    return "llm";
  }
}

type Config = { url: string; chave: string; modelos: string[] };

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Lê os provedores do ambiente, na ordem em que devem ser tentados.
 * Para no primeiro número que não tiver URL — a fila é contígua.
 */
function configurados(tipo: TipoDeTrabalho): Config[] {
  const fila: Config[] = [];

  for (let i = 1; i <= 5; i++) {
    const url = process.env[`LLM_${i}_URL`];
    if (!url) break;

    const modelos =
      tipo === "caro"
        ? lista(process.env[`LLM_${i}_MODELOS_CARO`])
        : lista(process.env[`LLM_${i}_MODELOS_BARATO`]).length
          ? lista(process.env[`LLM_${i}_MODELOS_BARATO`])
          : lista(process.env[`LLM_${i}_MODELOS_CARO`]);

    fila.push({ url, chave: process.env[`LLM_${i}_KEY`] ?? "", modelos });
  }

  // Compatibilidade com a configuração de provedor único.
  if (!fila.length && process.env.LLM_BASE_URL) {
    const modelos =
      tipo === "caro"
        ? lista(process.env.LLM_MODELO_CARO)
        : lista(process.env.LLM_MODELO_BARATO).length
          ? lista(process.env.LLM_MODELO_BARATO)
          : lista(process.env.LLM_MODELO_CARO);

    fila.push({
      url: process.env.LLM_BASE_URL,
      chave: process.env.LLM_API_KEY ?? "",
      modelos,
    });
  }

  return fila;
}

/**
 * A fila inteira, achatada: cada provedor com cada um dos seus modelos.
 *
 * Free tier costuma limitar por modelo, então listar vários do mesmo provedor
 * soma cota. E listar vários provedores soma de novo — quando o gratuito acaba,
 * o próximo assume sem ninguém precisar acordar.
 */
export function provedoresPara(tipo: TipoDeTrabalho, modeloForcado?: string | null) {
  const fila = configurados(tipo);

  if (!fila.length) {
    throw new AIErro(
      "Nenhum provedor configurado. Defina LLM_1_URL, LLM_1_KEY e LLM_1_MODELOS_CARO.",
      400,
      "llm",
    );
  }

  const provedores = [];

  for (const cfg of fila) {
    const nome = nomeDoProvedor(cfg.url);
    if (!cfg.chave) continue;

    const modelos = modeloForcado ? [modeloForcado] : cfg.modelos;
    for (const modelo of modelos) {
      const preco = precoDe(modelo);
      provedores.push(
        new ProvedorCompat({
          nome,
          baseUrl: cfg.url,
          apiKey: cfg.chave,
          modelo,
          precoEntrada: preco.entrada,
          precoSaida: preco.saida,
        }),
      );
    }
  }

  if (!provedores.length) {
    throw new AIErro(
      "Provedores configurados, mas sem chave ou sem modelo. Confira LLM_*_KEY e LLM_*_MODELOS_CARO.",
      401,
      "llm",
    );
  }

  return provedores;
}

/** Compatibilidade: o primeiro da fila. */
export function provedorPara(tipo: TipoDeTrabalho, modeloForcado?: string | null) {
  return provedoresPara(tipo, modeloForcado)[0];
}
