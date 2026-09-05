import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLog } from "@/lib/log";
import type { Agente, Tarefa } from "@/lib/tipos";

/**
 * Quem manda em quem, quem pega o quê, e para onde sobe o problema.
 *
 * O lock existe porque dois ticks simultâneos vão acontecer: o GitHub Actions
 * atrasa, refaz e sobrepõe execuções. Sem ele, dois runners pegam a mesma
 * tarefa e abrem dois PRs idênticos — e o segundo ainda paga tokens para
 * descobrir isso.
 */

/** Quanto tempo uma tarefa fica reservada antes de voltar pra fila sozinha. */
const LEASE_MINUTOS = 5;

const TENTATIVAS_ATE_ESCALAR = 3;

/**
 * Devolve à fila o que ficou preso. Um tick que morre no timeout de 60s deixa a
 * tarefa em `em_andamento` para sempre; o lease vencido conserta isso sem
 * ninguém precisar olhar.
 */
export async function liberarTarefasPresas(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("tarefas")
    .update({ status: "pendente", lock_ate: null })
    .eq("status", "em_andamento")
    .lt("lock_ate", new Date().toISOString())
    .select("id");

  if (error) throw new Error(`não consegui liberar tarefas presas: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Pega a próxima tarefa do agente, com lock otimista.
 *
 * O truque é o `.eq("status", "pendente")` dentro do UPDATE: dois ticks podem
 * ler a mesma linha, mas só um consegue escrevê-la, porque o segundo já não
 * encontra o status que esperava. Quem perder recebe lista vazia e segue a vida.
 */
export async function pegarProximaTarefa(
  supabase: SupabaseClient,
  agente: Agente,
): Promise<Tarefa | null> {
  const { data: candidatas, error } = await supabase
    .from("tarefas")
    .select("*")
    .eq("status", "pendente")
    .or(`agente_id.eq.${agente.id},agente_id.is.null`)
    .order("prioridade", { ascending: false })
    .order("criado_em", { ascending: true })
    .limit(5);

  if (error) throw new Error(`não consegui ler a fila: ${error.message}`);

  const lockAte = new Date(Date.now() + LEASE_MINUTOS * 60_000).toISOString();

  for (const candidata of candidatas ?? []) {
    const { data: presa } = await supabase
      .from("tarefas")
      .update({
        status: "em_andamento",
        agente_id: agente.id,
        lock_ate: lockAte,
        iniciado_em: candidata.iniciado_em ?? new Date().toISOString(),
      })
      .eq("id", candidata.id)
      .eq("status", "pendente")
      .select("*")
      .maybeSingle();

    if (presa) return presa as Tarefa;
  }

  return null;
}

/** Renova o lease enquanto o agente ainda está trabalhando. */
export async function renovarLock(supabase: SupabaseClient, tarefaId: string): Promise<void> {
  await supabase
    .from("tarefas")
    .update({ lock_ate: new Date(Date.now() + LEASE_MINUTOS * 60_000).toISOString() })
    .eq("id", tarefaId);
}

export async function devolverParaFila(
  supabase: SupabaseClient,
  tarefa: Tarefa,
  passos: number,
): Promise<void> {
  await supabase
    .from("tarefas")
    .update({ status: "pendente", lock_ate: null, passos })
    .eq("id", tarefa.id);
}

export async function concluirTarefa(
  supabase: SupabaseClient,
  tarefa: Tarefa,
  resultado: string,
  passos: number,
): Promise<void> {
  await supabase
    .from("tarefas")
    .update({
      status: "concluida",
      resultado: resultado.slice(0, 4000),
      passos,
      lock_ate: null,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", tarefa.id);
}

/**
 * Falhou. Tenta de novo até três vezes; depois sobe para o superior.
 *
 * Ninguém escala direto para o Kauã: se todo agente pudesse chamar o chefe, o
 * Telegram dele viraria lixeira e ele pararia de ler — que é o pior resultado
 * possível, porque aí os avisos que importam também se perdem.
 */
export async function falharOuEscalar(
  supabase: SupabaseClient,
  tarefa: Tarefa,
  agente: Agente,
  motivo: string,
  passos: number,
): Promise<"repetir" | "escalada" | "chefe"> {
  const tentativas = tarefa.tentativas + 1;

  if (tentativas < TENTATIVAS_ATE_ESCALAR) {
    await supabase
      .from("tarefas")
      .update({ status: "pendente", tentativas, passos, lock_ate: null })
      .eq("id", tarefa.id);

    await registrarLog(supabase, {
      agente_id: agente.id,
      tarefa_id: tarefa.id,
      nivel: "warn",
      mensagem: `tentativa ${tentativas} falhou: ${motivo}`,
    });

    return "repetir";
  }

  const superior = agente.superior_id;

  await supabase
    .from("tarefas")
    .update({
      status: "bloqueada",
      tentativas,
      passos,
      lock_ate: null,
      escalada_para: superior,
      resultado: motivo.slice(0, 4000),
    })
    .eq("id", tarefa.id);

  if (superior) {
    // Vira tarefa do superior: alguém precisa decidir o que fazer com isto.
    await supabase.from("tarefas").insert({
      titulo: `Destravar: ${tarefa.titulo}`,
      descricao: `${agente.nome} tentou ${tentativas} vezes e não conseguiu.\n\nMotivo da última falha: ${motivo}\n\nDecida: refazer diferente, quebrar em partes menores, dar uma ferramenta que falta, ou descartar.`,
      agente_id: superior,
      atribuida_por: agente.id,
      prioridade: 8,
    });

    await registrarLog(supabase, {
      agente_id: agente.id,
      tarefa_id: tarefa.id,
      nivel: "erro",
      mensagem: `escalei "${tarefa.titulo}" para o meu superior`,
    });

    return "escalada";
  }

  // Sem superior: é o topo da cadeia, então o chefe humano precisa saber.
  await supabase.from("notificacoes").insert({
    texto: `${agente.nome} travou em "${tarefa.titulo}" depois de ${tentativas} tentativas.\n\n${motivo}`,
    urgencia: "normal",
    tarefa_id: tarefa.id,
  });

  return "chefe";
}

export async function colegasDe(
  supabase: SupabaseClient,
  agente: Agente,
): Promise<{ superior: Agente | null; colegas: Agente[] }> {
  const { data } = await supabase.from("agentes").select("*").eq("ativo", true);
  const todos = (data ?? []) as Agente[];

  return {
    superior: todos.find((a) => a.id === agente.superior_id) ?? null,
    colegas: todos.filter((a) => a.id !== agente.id),
  };
}
