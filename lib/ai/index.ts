import type { Mensagem, RespostaDoModelo } from "@/lib/tipos";
import { provedorPara, type TipoDeTrabalho } from "./provedor";
import { AIErro, type OpcoesDeConversa } from "./tipos";

export { AIErro } from "./tipos";
export type { FerramentaDeclarada, OpcoesDeConversa } from "./tipos";
export { provedorPara } from "./provedor";
export type { TipoDeTrabalho } from "./provedor";

const TENTATIVAS = 3;
const ESPERA_BASE_MS = 1000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma rodada de conversa com backoff exponencial.
 *
 * Só repete o que vale a pena repetir: 429 e 5xx são congestionamento ou falha
 * do outro lado; 401 e 400 são erro nosso, e insistir só queima tempo do tick,
 * que tem 60 segundos no total.
 */
export async function conversar(
  mensagens: Mensagem[],
  opcoes: OpcoesDeConversa & {
    tipo?: TipoDeTrabalho;
    modelo?: string | null;
  } = {},
): Promise<RespostaDoModelo & { custo: number }> {
  const { tipo = "caro", modelo, ...resto } = opcoes;
  const provedor = provedorPara(tipo, modelo);

  let ultimo: unknown;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resposta = await provedor.conversar(mensagens, resto);
      return {
        ...resposta,
        custo: provedor.custo(resposta.tokensEntrada, resposta.tokensSaida),
      };
    } catch (e) {
      ultimo = e;
      if (e instanceof AIErro && !e.valeRepetir) throw e;
      if (tentativa < TENTATIVAS) await dormir(ESPERA_BASE_MS * 2 ** (tentativa - 1));
    }
  }

  throw ultimo;
}
