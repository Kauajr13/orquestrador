import { ProvedorCompat } from "./openai-compat";
import { AIErro } from "./tipos";

/**
 * O b.ai é o provedor atual: um gateway compatível com a API de chat da OpenAI,
 * com uma promoção de tokens gratuitos. A promoção vai acabar — por isso nada
 * aqui é hardcoded e o custo é calculado a preço de mercado desde o primeiro
 * dia. Quando a conta chegar, ninguém vai ser pego de surpresa, e trocar de
 * provedor é mudar duas variáveis de ambiente.
 */

const BASE_URL_PADRAO = "https://api.b.ai/v1";

/**
 * Trabalho barato (classificar, resumir, escrever texto) vai no modelo pequeno;
 * código e decisão estratégica vão no grande. Enquanto os tokens são gratuitos
 * isso não dói, mas o hábito precisa nascer agora: depois, mudar o roteamento é
 * trocar uma env var em vez de refazer a arquitetura.
 */
export type TipoDeTrabalho = "barato" | "caro";

/**
 * Preço de mercado por 1 milhão de tokens, em USD, por prefixo de modelo.
 * Serve para estimar ordem de grandeza, não para faturar — o objetivo é o Kauã
 * ver a projeção mensal antes de a promoção acabar.
 */
const PRECOS: Array<{ prefixo: string; entrada: number; saida: number }> = [
  { prefixo: "claude-opus", entrada: 15, saida: 75 },
  { prefixo: "claude-sonnet", entrada: 3, saida: 15 },
  { prefixo: "claude-haiku", entrada: 0.8, saida: 4 },
  { prefixo: "gpt-5", entrada: 1.25, saida: 10 },
  { prefixo: "gpt-4", entrada: 2.5, saida: 10 },
  { prefixo: "gemini", entrada: 1.25, saida: 5 },
  { prefixo: "deepseek", entrada: 0.28, saida: 0.42 },
  { prefixo: "mimo", entrada: 0.2, saida: 0.4 },
  { prefixo: "hy3", entrada: 0.3, saida: 0.6 },
];

// Modelo desconhecido cai aqui. Preferimos superestimar: uma projeção alta
// demais faz o Kauã olhar; uma baixa demais faz ele não olhar.
const PRECO_PADRAO = { entrada: 3, saida: 15 };

function precoDe(modelo: string) {
  const m = modelo.toLowerCase();
  return PRECOS.find((p) => m.includes(p.prefixo)) ?? PRECO_PADRAO;
}

export function provedorPara(tipo: TipoDeTrabalho, modeloForcado?: string | null) {
  const apiKey = process.env.BAI_API_KEY ?? "";
  if (!apiKey) {
    throw new AIErro("BAI_API_KEY ausente no ambiente", 401, "b.ai");
  }

  const modelo =
    modeloForcado ||
    (tipo === "caro"
      ? process.env.BAI_MODELO_CARO
      : process.env.BAI_MODELO_BARATO ?? process.env.BAI_MODELO_CARO);

  if (!modelo) {
    throw new AIErro(
      "Defina BAI_MODELO_CARO (e de preferência BAI_MODELO_BARATO) no ambiente",
      400,
      "b.ai",
    );
  }

  const preco = precoDe(modelo);

  return new ProvedorCompat({
    nome: "b.ai",
    baseUrl: process.env.BAI_BASE_URL ?? BASE_URL_PADRAO,
    apiKey,
    modelo,
    precoEntrada: preco.entrada,
    precoSaida: preco.saida,
  });
}
