import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contexto } from "@/lib/agentes/ferramentas/tipos";
import type { Agente, Tarefa } from "@/lib/tipos";

/**
 * Dublês para os testes da constituição.
 *
 * O supabase falso grita quando é usado: os testes daqui verificam travas que
 * DEVEM barrar antes de qualquer escrita no banco. Se uma trava passar do
 * ponto e tentar gravar, o teste quebra — que é exatamente o aviso que
 * queremos.
 */
export function supabaseQueNaoDeveSerUsado(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error("a trava deixou o fluxo chegar no banco — não deveria");
    },
  });
}

/** Supabase falso que devolve linhas fixas para as consultas encadeadas. */
export function supabaseFake(respostas: Record<string, unknown[]>): SupabaseClient {
  const construir = (tabela: string) => {
    const resultado = { data: respostas[tabela] ?? [], error: null };
    const encadeavel: Record<string, unknown> = {};
    for (const metodo of [
      "select",
      "eq",
      "neq",
      "is",
      "not",
      "or",
      "gte",
      "lt",
      "in",
      "ilike",
      "order",
      "limit",
    ]) {
      encadeavel[metodo] = () => encadeavel;
    }
    encadeavel.maybeSingle = async () => ({
      data: (respostas[tabela] ?? [])[0] ?? null,
      error: null,
    });
    encadeavel.single = async () => ({
      data: (respostas[tabela] ?? [])[0] ?? null,
      error: null,
    });
    encadeavel.insert = () => encadeavel;
    encadeavel.update = () => encadeavel;
    encadeavel.upsert = () => encadeavel;
    encadeavel.then = (
      aceitar: (v: typeof resultado) => unknown,
    ) => Promise.resolve(resultado).then(aceitar);
    return encadeavel;
  };

  return { from: (tabela: string) => construir(tabela) } as unknown as SupabaseClient;
}

export function agenteFake(sobrescrever: Partial<Agente> = {}): Agente {
  return {
    id: "agente-1",
    nome: "Teste",
    papel: "gestor",
    prompt: "Você testa coisas.",
    superior_id: null,
    time_id: null,
    status: "idle",
    ferramentas: [],
    skills: [],
    sprite: "funcionario",
    modelo: null,
    ativo: true,
    criado_em: new Date().toISOString(),
    contratado_por: null,
    ...sobrescrever,
  };
}

export function tarefaFake(sobrescrever: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "tarefa-1",
    titulo: "Uma tarefa",
    descricao: "",
    status: "em_andamento",
    agente_id: "agente-1",
    atribuida_por: null,
    escalada_para: null,
    executor: "nuvem",
    prioridade: 5,
    pr_numero: null,
    pr_url: null,
    branch: null,
    parecer: null,
    resultado: null,
    tentativas: 0,
    passos: 0,
    lock_ate: null,
    criado_em: new Date().toISOString(),
    iniciado_em: null,
    concluido_em: null,
    ...sobrescrever,
  };
}

export function contextoFake(sobrescrever: Partial<Contexto> = {}): Contexto {
  return {
    supabase: supabaseQueNaoDeveSerUsado(),
    agente: agenteFake(),
    tarefa: tarefaFake(),
    fontesLidas: [],
    skillsCarregadas: new Set<string>(),
    registrar: async () => {},
    ...sobrescrever,
  };
}
