import { Diario, Folha, Funcionarios, QuadroDeMeta, UltimasTarefas } from "@/components/escritorio/Paineis";
import { Sala } from "@/components/escritorio/Sala";
import { Terminal } from "@/components/escritorio/Terminal";
import { saldoDisponivel } from "@/lib/caixa";
import {
  AGENTES_EXEMPLO,
  DIARIO_EXEMPLO,
  LOGS_EXEMPLO,
  META_EXEMPLO,
  SALARIOS_EXEMPLO,
  TAREFAS_EXEMPLO,
  TIMES_EXEMPLO,
} from "@/lib/exemplo";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { metaAtiva, agentePorNome, lastTick } from "@/lib/consultas-banco";
import type { Agente, Log, Meta, Tarefa, Time } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type Escritorio = {
  demonstracao: boolean;
  agentes: Agente[];
  times: Time[];
  tarefas: Tarefa[];
  logs: Log[];
  meta: Meta | null;
  salarios: Record<string, { tokens: number; custo: number }>;
  diario: { id: string; agente_id: string; dia: string; texto: string }[];
  saldo: number;
  escalado: boolean;
};

/**
 * Enquanto não houver banco, a tela mostra um escritório de demonstração — e
 * diz que é. Uma interface que só existe depois das credenciais não pode ser
 * ajustada antes delas, e ajustar interface é a parte que mais precisa de
 * idas e voltas.
 */
async function carregarEscritorio(): Promise<Escritorio> {
  const demo: Escritorio = {
    demonstracao: true,
    agentes: AGENTES_EXEMPLO,
    times: TIMES_EXEMPLO,
    tarefas: TAREFAS_EXEMPLO,
    logs: LOGS_EXEMPLO,
    meta: META_EXEMPLO,
    salarios: SALARIOS_EXEMPLO,
    diario: DIARIO_EXEMPLO,
    saldo: 0,
    escalado: false,
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return demo;
  }

  try {
    const supabase = supabaseAdmin();
    const inicioDoMes = new Date();
    inicioDoMes.setUTCDate(1);
    inicioDoMes.setUTCHours(0, 0, 0, 0);

    const [agentes, times, tarefas, logs, metas, execucoes, diario, saldo] = await Promise.all([
      supabase.from("agentes").select("*").eq("ativo", true).order("criado_em"),
      supabase.from("times").select("*"),
      supabase.from("tarefas").select("*").order("criado_em", { ascending: false }).limit(12),
      supabase.from("logs").select("*").order("criado_em", { ascending: false }).limit(80),
      supabase.from("metas").select("*").eq("ativa", true).limit(1),
      supabase
        .from("execucoes")
        .select("agente_id, tokens_entrada, tokens_saida, custo_estimado")
        .gte("criado_em", inicioDoMes.toISOString()),
      supabase.from("diario").select("*").order("dia", { ascending: false }).limit(6),
      saldoDisponivel(supabase),
    ] as const);

    const salarios: Record<string, { tokens: number; custo: number }> = {};
    for (const e of execucoes.data ?? []) {
      const id = e.agente_id as string;
      const atual = salarios[id] ?? { tokens: 0, custo: 0 };
      salarios[id] = {
        tokens: atual.tokens + Number(e.tokens_entrada ?? 0) + Number(e.tokens_saida ?? 0),
        custo: atual.custo + Number(e.custo_estimado ?? 0),
      };
    }

    let