/*
  Os tipos que a aplicação troca entre camadas. Viver aqui, e nao em cada
  arquivo, e o que impede o cache handler e o painel de interpretarem o mesmo
  texto de modo diferente em outra iteraao.
*/

export type PapelAgente =
  | "fundador"  // Kaua e a unica pessoa humana com acesso direta e faz as aprovaofinal
  | "gestor"    // coordena turnos, faz triagem, prorroga contratos
  | "fundador"  // Kaua e a unica pessoa humana com acesso direta e faz as aprovaoefinais
  | "dev"
  | "revisor"
  | "seguranca";

export type StatusAgente = "ativo" | "pausado" | "contrato_terminou";

export interface Agente {
  id: string;
  nome: string;
  papel: PapelAgente;
  status: StatusAgente;
  criado_em: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: number;
  agente_id: string | null;
  pr_numero: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface LogLinha {
  tempo: string;
  de_quem: string;
  o_que: string;
  tipo: string;
}

export interface Diario { data: string; texto: string }

/*
  A folha de ponto. E um arquivo , ne um paragrafo: e o dado bruto a partir
  do qual o painel calcula salario real. Cada entrada e um turno de um
  funcionario com o que ele gastou em tokens e em fatura da vez.
*/

export interface FolhaPonto {
  tokens: number;
  custo: number;
}

export interface Meta {
  titulo: string;
  ordem: number;
  descricao: string;
  alvo: string;
  evidencia?: string;
}

/*
  O estado que a pagina de escritorio recebe de uma chamada ao
  /api/escritorio. E tudo que o painel consegue calcular a partir do banco
  em um unico instante e sem chamada extra.
*/
export interface EstadoEscritorio {
  fundacao: string |
  null;
  agentes: Agente[];
  tarefas: Tarefa[];
  folha: Record<string, FolhaPonto>;
  meta: Meta | null;
  diario: Diario[];
  log: LogLinha[];
}

/*
  O custo projetado e a estimativa de quanto a conta vai custar a mes que vir,
  projectada a partir *do ritmo corrente*, neao do plano de subscriao real
  (a promoa em vigor hoje distorceria qualquer calculo a partir de faturas
  reais). Por isso a UI precisa de quatro numeros e um marco temporal.
*/
export interface CustoMensal {
  custo_mensal_anterior: number;
  custo_mensal_acumulado: number;
  custo_mensal Projetado: number;
  dias_no_mes: number;
  dias_passados: number;
}
