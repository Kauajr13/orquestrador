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
import type { Agente, Log, Meta, Tarefa, Time } from "@/lib/tipos";
import { useEffect, useState } from "react";

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
    ]);

    const salarios: Record<string, { tokens: number; custo: number }> = {};
    for (const e of execucoes.data ?? []) {
      const id = e.agente_id as string;
      const atual = salarios[id] ?? { tokens: 0, custo: 0 };
      salarios[id] = {
        tokens: atual.tokens + Number(e.tokens_entrada ?? 0) + Number(e.tokens_saida ?? 0),
        custo: atual.custo + Number(e.custo_estimado ?? 0),
      };
    }

    const listaDeTarefas = (tarefas.data ?? []) as Tarefa[];

    return {
      demonstracao: false,
      agentes: (agentes.data ?? []) as Agente[],
      times: (times.data ?? []) as Time[],
      tarefas: listaDeTarefas,
      // O terminal lê de baixo para cima; o banco devolve do mais novo.
      logs: ((logs.data ?? []) as Log[]).slice().reverse(),
      meta: ((metas.data ?? [])[0] as Meta) ?? null,
      salarios,
      diario: (diario.data ?? []) as Escritorio["diario"],
      saldo,
      escalado: listaDeTarefas.some((t) => t.status === "bloqueada"),
    };
  } catch {
    // Banco fora do ar não pode derrubar o painel: é justamente quando o Kauã
    // mais precisa olhar para a tela.
    return demo;
  }
}

// Cliente component to display the last tick timestamp
"use client";
function LastTick() {
  const [timestamp, setTimestamp] = useState<string>("");

  const fetchTimestamp = async () => {
    try {
      const res = await fetch("/api/last-log", { cache: "no-store" });
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      // Assume API returns { timestamp: string }
      setTimestamp(data.timestamp);
    } catch (e) {
      console.error("Failed to fetch last tick:", e);
      setTimestamp("");
    }
  };

  useEffect(() => {
    fetchTimestamp();
    const interval = setInterval(fetchTimestamp, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-xs text-apagado">
      Último tick: {timestamp ? new Date(timestamp).toLocaleString() : "-"}
    </p>
  );
}

export default async function Pagina() {
  const e = await carregarEscritorio();
  const nomes = Object.fromEntries(e.agentes.map((a) => [a.id, a.nome]));

  return (
    <main className="flex-1 p-3 sm:p-5 max-w-[1400px] w-full mx-auto space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl sm:text-2xl tracking-wide">
          Escritório<span className="text-fosforo">_</span>
        </h1>
        <div className="flex flex-col items-end">
          <p className="text-xs text-apagado">
            {e.demonstracao
              ? "modo demonstração — sem banco conectado"
              : `${e.agentes.length} funcionários · ${e.tarefas.filter((t) => t.status === "pendente").length} na fila`}
          </p>
          <LastTick />
        </div>
      </header>

      {/* `min-w-0` em todo item de grid: sem
        overflow horizontal, o texto quebra e a UI não explode.
        Também garante que o grid se expanda ao tamanho do container.
      */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Diario diario={e.diario} />
        <Folha salarios={e.salarios} agentes={e.agentes} />
        <Funcionarios agentes={e.agentes} nomes={nomes} />
        <QuadroDeMeta meta={e.meta} />
        <UltimasTarefas tarefas={e.tarefas} />
        <Sala logs={e.logs} />
        <Terminal logs={e.logs} />
      </section>
    </main>
  );
}
