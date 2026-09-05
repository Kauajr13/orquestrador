import type { Mensagem, RespostaDoModelo } from "@/lib/tipos";
import { provedoresPara, type TipoDeTrabalho } from "./provedor";
import { AIErro, type OpcoesDeConversa } from "./tipos";

export { AIErro } from "./tipos";
export type { FerramentaDeclarada, OpcoesDeConversa } from "./tipos";
export { provedorPara, provedoresPara } from "./provedor";
export type { TipoDeTrabalho } from "./provedor";

const TENTATIVAS_POR_MODELO = 2;
const ESPERA_BASE_MS = 1000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma rodada de conversa, atravessando a fila de modelos.
 *
 * Duas coisas acontecem aqui, e é útil separá-las:
 *
 *   - Falha passageira (503, rede caindo): o mesmo modelo tenta de novo, com
 *     espera crescente.
 *   - Cota esgotada (429): insistir não adianta, porque no free tier o limite
 *     costuma ser diário e por modelo. Aí passamos para o próximo da fila, que
 *     tem cota própria. É assim que quatro modelos de 20 chamadas por dia viram
 *     um dia de trabalho utilizável.
 *
 * Se a fila inteira esgotar, o erro sobe e o runner guarda o estado — o próximo
 * tick tenta de novo, e amanhã as cotas terão virado.
 */
export async function conversar(
  mensagens: Mensagem[],
  opcoes: OpcoesDeConversa & {
    tipo?: TipoDeTrabalho;
    modelo?: string | null;
  } = {},
): Promise<RespostaDoModelo & { custo: number }> {
  const { tipo = "caro", modelo, ...resto } = opcoes;
  const fila = provedoresPara(tipo, modelo);

  let ultimo: unknown;

  for (const provedor of fila) {
    for (let tentativa = 1; tentativa <= TENTATIVAS_POR_MODELO; tentativa++) {
      try {
        const resposta = await provedor.conversar(mensagens, resto);
        return {
          ...resposta,
          custo: provedor.custo(resposta.tokensEntrada, resposta.tokensSaida),
        };
      } catch (e) {
        ultimo = e;

        if (e instanceof AIErro) {
          // Cota do modelo acabou (429) ou o prompt passou do teto de tokens
          // por minuto daquele modelo (413): nos dois casos, insistir no mesmo
          // modelo não muda nada. Próximo da fila, que tem cota e teto próprios.
          if (e.status === 429 || e.status === 413) break;
          // Erro nosso (chave errada, payload inválido): trocar de modelo não
          // resolve, e insistir só queima o orçamento do tick.
          if (!e.valeRepetir) throw e;
        }

        if (tentativa < TENTATIVAS_POR_MODELO) {
          await dormir(ESPERA_BASE_MS * 2 ** (tentativa - 1));
        }
      }
    }
  }

  throw ultimo;
}
