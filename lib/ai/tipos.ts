import type { Mensagem, RespostaDoModelo } from "@/lib/tipos";

/** Erro de provedor com status, pra decidir se vale a pena tentar de novo. */
export class AIErro extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly provedor: string,
  ) {
    super(mensagem);
    this.name = "AIErro";
  }

  /** 4xx é culpa nossa (chave errada, payload inválido): repetir não adianta. */
  get valeRepetir(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** Descrição de ferramenta no formato que a API de chat espera. */
export type FerramentaDeclarada = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpcoesDeConversa = {
  ferramentas?: FerramentaDeclarada[];
  maxTokens?: number;
  temperatura?: number;
};

export interface Provedor {
  readonly nome: string;
  readonly modelo: string;
  conversar(mensagens: Mensagem[], opcoes?: OpcoesDeConversa): Promise<RespostaDoModelo>;
}
