/**
 * O vocabulário da empresa. Espelha as colunas de supabase/schema.sql — quando
 * uma migration mudar uma tabela, este arquivo muda junto no mesmo PR.
 */

export type StatusAgente = "idle" | "working" | "done" | "error" | "descansando";

export type StatusTarefa =
  | "pendente"
  | "em_andamento"
  | "em_revisao"
  | "mudancas_pedidas"
  | "aprovada"
  | "concluida"
  | "falhou"
  | "bloqueada";

export type NivelLog = "info" | "warn" | "erro" | "sucesso";

export type Agente = {
  id: string;
  nome: string;
  papel: string;
  prompt: string;
  superior_id: string | null;
  time_id: string | null;
  status: StatusAgente;
  ferramentas: string[];
  skills: string[];
  sprite: string;
  modelo: string | null;
  ativo: boolean;
  criado_em: string;
  contratado_por: string | null;
};

export type Time = {
  id: string;
  nome: string;
  lider_id: string | null;
  criado_em: string;
};

export type Tarefa = {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusTarefa;
  agente_id: string | null;
  atribuida_por: string | null;
  escalada_para: string | null;
  executor: "nuvem" | "local";
  prioridade: number;
  pr_numero: number | null;
  pr_url: string | null;
  branch: string | null;
  parecer: string | null;
  resultado: string | null;
  tentativas: number;
  passos: number;
  lock_ate: string | null;
  criado_em: string;
  iniciado_em: string | null;
  concluido_em: string | null;
};

export type Execucao = {
  id: string;
  agente_id: string;
  tarefa_id: string | null;
  conversa: Mensagem[];
  encerrada: boolean;
  modelo: string | null;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado: number;
  duracao_ms: number;
  criado_em: string;
  atualizado_em: string;
};

export type Log = {
  id: string;
  agente_id: string | null;
  tarefa_id: string | null;
  nivel: NivelLog;
  mensagem: string;
  criado_em: string;
};

export type Meta = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string;
  alvo: string;
  ativa: boolean;
  atingida: boolean;
  evidencia: string | null;
  criado_em: string;
  atingida_em: string | null;
};

export type Pagina = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  fontes: string[];
  publicada: boolean;
  agente_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

// --------------------------------------------------------------- conversa

/**
 * Formato de mensagem da API de chat. Fica salvo em `execucoes.conversa` para
 * o raciocínio de um agente atravessar vários ticks: a função da Vercel morre
 * em 60s, então o próximo tick lê isto e continua em vez de recomeçar.
 */
export type Mensagem =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChamadaDeFerramenta[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export type ChamadaDeFerramenta = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** O que o provedor devolve num turno. */
export type RespostaDoModelo = {
  conteudo: string | null;
  chamadas: ChamadaDeFerramenta[];
  tokensEntrada: number;
  tokensSaida: number;
  modelo: string;
  parou: boolean;
};
