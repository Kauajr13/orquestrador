import type { Agente, Log, Meta, Tarefa, Time } from "@/lib/tipos";

/**
 * O escritório de mentira.
 *
 * Serve para a interface poder ser vista e ajustada antes de existir um banco —
 * e para o painel não mostrar uma tela preta enquanto as credenciais não
 * chegam. Fica claramente marcado como demonstração na tela, senão é só uma
 * forma elegante de mentir.
 */

const agora = new Date();
const minutosAtras = (n: number) => new Date(agora.getTime() - n * 60_000).toISOString();

export const AGENTES_EXEMPLO: Agente[] = [
  {
    id: "ex-gestor",
    nome: "Íris",
    papel: "gestor",
    prompt: "",
    superior_id: null,
    time_id: null,
    status: "working",
    ferramentas: [],
    skills: [],
    sprite: "gestor",
    modelo: null,
    ativo: true,
    criado_em: minutosAtras(6000),
    contratado_por: null,
  },
  {
    id: "ex-dev",
    nome: "Tobias",
    papel: "dev",
    prompt: "",
    superior_id: "ex-gestor",
    time_id: null,
    status: "working",
    ferramentas: [],
    skills: [],
    sprite: "dev",
    modelo: null,
    ativo: true,
    criado_em: minutosAtras(5900),
    contratado_por: "ex-gestor",
  },
  {
    id: "ex-revisor",
    nome: "Nara",
    papel: "revisor",
    prompt: "",
    superior_id: "ex-gestor",
    time_id: null,
    status: "descansando",
    ferramentas: [],
    skills: [],
    sprite: "revisor",
    modelo: null,
    ativo: true,
    criado_em: minutosAtras(5800),
    contratado_por: "ex-gestor",
  },
];

export const TIMES_EXEMPLO: Time[] = [];

export const TAREFAS_EXEMPLO: Tarefa[] = [
  {
    id: "ex-t1",
    titulo: "Pesquisar nicho e registrar a escolha com evidência",
    descricao: "",
    status: "em_andamento",
    agente_id: "ex-gestor",
    atribuida_por: null,
    escalada_para: null,
    executor: "nuvem",
    prioridade: 10,
    pr_numero: null,
    pr_url: null,
    branch: null,
    parecer: null,
    resultado: null,
    tentativas: 0,
    passos: 4,
    lock_ate: null,
    criado_em: minutosAtras(40),
    iniciado_em: minutosAtras(38),
    concluido_em: null,
  },
  {
    id: "ex-t2",
    titulo: "Painel de custo projetado",
    descricao: "",
    status: "em_revisao",
    agente_id: "ex-dev",
    atribuida_por: "ex-gestor",
    escalada_para: null,
    executor: "nuvem",
    prioridade: 6,
    pr_numero: 12,
    pr_url: "#",
    branch: "agente/tobias-1a2b3c4d",
    parecer: null,
    resultado: null,
    tentativas: 0,
    passos: 9,
    lock_ate: null,
    criado_em: minutosAtras(120),
    iniciado_em: minutosAtras(110),
    concluido_em: null,
  },
  {
    id: "ex-t3",
    titulo: "Contratar um Pesquisador de Mercado",
    descricao: "",
    status: "pendente",
    agente_id: null,
    atribuida_por: "ex-gestor",
    escalada_para: null,
    executor: "nuvem",
    prioridade: 9,
    pr_numero: null,
    pr_url: null,
    branch: null,
    parecer: null,
    resultado: null,
    tentativas: 0,
    passos: 0,
    lock_ate: null,
    criado_em: minutosAtras(200),
    iniciado_em: null,
    concluido_em: null,
  },
];

export const META_EXEMPLO: Meta = {
  id: "ex-m1",
  ordem: 1,
  titulo: "Nicho com evidência",
  descricao:
    "Escolher em que mercado a empresa vai atuar, com pesquisa de verdade e não com palpite.",
  alvo: "Uma escolha registrada na memória, com no mínimo 5 fontes e a razão de ter descartado as alternativas.",
  ativa: true,
  atingida: false,
  evidencia: null,
  criado_em: minutosAtras(6000),
  atingida_em: null,
};

export const LOGS_EXEMPLO: Log[] = [
  {
    id: "ex-l1",
    agente_id: "ex-gestor",
    tarefa_id: "ex-t1",
    nivel: "info",
    mensagem: 'peguei "Pesquisar nicho e registrar a escolha com evidência"',
    criado_em: minutosAtras(38),
  },
  {
    id: "ex-l2",
    agente_id: "ex-gestor",
    tarefa_id: "ex-t1",
    nivel: "info",
    mensagem: "usei buscar_web",
    criado_em: minutosAtras(37),
  },
  {
    id: "ex-l3",
    agente_id: "ex-dev",
    tarefa_id: "ex-t2",
    nivel: "sucesso",
    mensagem: "abri o PR #12: painel de custo projetado",
    criado_em: minutosAtras(22),
  },
  {
    id: "ex-l4",
    agente_id: "ex-revisor",
    tarefa_id: "ex-t2",
    nivel: "warn",
    mensagem: "CI ainda rodando; volto no próximo tick",
    criado_em: minutosAtras(18),
  },
];

export const SALARIOS_EXEMPLO: Record<string, { tokens: number; custo: number }> = {
  "ex-gestor": { tokens: 184_300, custo: 1.42 },
  "ex-dev": { tokens: 512_800, custo: 4.06 },
  "ex-revisor": { tokens: 96_400, custo: 0.71 },
};

export const DIARIO_EXEMPLO = [
  {
    id: "ex-d1",
    agente_id: "ex-gestor",
    dia: new Date().toISOString().slice(0, 10),
    texto:
      "Passei o dia lendo sobre três mercados. Dois pareciam bons até eu procurar quem já vende neles.",
  },
  {
    id: "ex-d2",
    agente_id: "ex-dev",
    dia: new Date().toISOString().slice(0, 10),
    texto: "Abri o PR do painel de custo. Sem revisão, meu trabalho de hoje não vale nada.",
  },
];
