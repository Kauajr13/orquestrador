import { NextResponse } from "next/server";
import { CATALOGO } from "@/lib/agentes/ferramentas";
import {
  concluirTarefa,
  devolverParaFila,
  falharOuEscalar,
  liberarTarefasPresas,
  pegarProximaTarefa,
} from "@/lib/agentes/hierarquia";
import {
  dentroDoExpediente,
  estaPausado,
  lerConfig,
  numero,
  tetoDiarioAtingido,
} from "@/lib/agentes/jornada";
import { montarPromptDoAgente } from "@/lib/agentes/preparar";
import { revisar } from "@/lib/agentes/revisao";
import { executarPasso } from "@/lib/agentes/runner";
import { registrarLog } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { despacharNotificacoes } from "@/lib/telegram";
import type { Agente, Tarefa } from "@/lib/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * O tick do escritório. Chamado a cada 15 minutos pelo GitHub Actions —
 * o cron da Vercel no plano gratuito não é confiável abaixo de diário.
 *
 * Cada tick faz UM pedaço de trabalho e volta. Não é preguiça: a função morre
 * aos 60 segundos, e um agente pensando com ferramentas passa disso fácil. O
 * estado fica salvo em `execucoes.conversa`, então o próximo tick continua de
 * onde este parou em vez de repagar tudo desde o começo.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const segredo = process.env.CRON_SECRET;
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cfg = await lerConfig(supabase);

  // Regra 1 da constituição, e ela vem antes de tudo de propósito: o freio
  // precisa funcionar mesmo quando o resto estiver quebrado.
  if (estaPausado(cfg)) {
    return NextResponse.json({ ok: true, feito: "nada", motivo: "escritório pausado" });
  }

  // Notificações saem mesmo fora do expediente (as críticas) e mesmo se
  // ninguém for trabalhar neste tick.
  const enviadas = await despacharNotificacoes(supabase, cfg).catch(() => 0);

  const liberadas = await liberarTarefasPresas(supabase);

  if (!dentroDoExpediente(cfg)) {
    await supabase
      .from("agentes")
      .update({ status: "descansando" })
      .eq("ativo", true)
      .neq("status", "descansando");

    return NextResponse.json({
      ok: true,
      feito: "nada",
      motivo: "fora do expediente",
      enviadas,
      liberadas,
    });
  }

  const teto = await tetoDiarioAtingido(supabase, cfg);
  if (teto.atingido) {
    await supabase.from("agentes").update({ status: "descansando" }).eq("ativo", true);
    return NextResponse.json({ ok: true, feito: "nada", motivo: teto.motivo, enviadas });
  }

  const { data: agentes } = await supabase
    .from("agentes")
    .select("*")
    .eq("ativo", true)
    .order("criado_em", { ascending: true });

  const time = (agentes ?? []) as Agente[];
  if (!time.length) {
    return NextResponse.json({ ok: true, feito: "nada", motivo: "ninguém contratado ainda" });
  }

  // Revisão vem antes de código novo: PR parado bloqueia quem o abriu, e um
  // Dev esperando revisão é trabalho já pago esperando para valer alguma coisa.
  const revisado = await tentarRevisar(supabase, time);
  if (revisado) return NextResponse.json({ ok: true, feito: "revisão", ...revisado, enviadas });

  const trabalhado = await tentarTrabalhar(supabase, time, numero(cfg, "teto_passos_tarefa", 25));
  if (trabalhado) return NextResponse.json({ ok: true, feito: "trabalho", ...trabalhado, enviadas });

  await supabase
    .from("agentes")
    .update({ status: "idle" })
    .eq("ativo", true)
    .eq("status", "working");

  return NextResponse.json({ ok: true, feito: "nada", motivo: "fila vazia", enviadas, liberadas });
}

async function tentarRevisar(
  supabase: ReturnType<typeof supabaseAdmin>,
  time: Agente[],
): Promise<Record<string, unknown> | null> {
  const revisor = time.find((a) => a.papel === "revisor");
  if (!revisor) return null;

  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .eq("status", "em_revisao")
    .not("pr_numero", "is", null)
    .neq("agente_id", revisor.id) // regra 3: nunca o próprio PR
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const tarefa = data as Tarefa;

  await supabase.from("agentes").update({ status: "working" }).eq("id", revisor.id);

  try {
    const r = await revisar(supabase, revisor, tarefa);
    await supabase
      .from("agentes")
      .update({ status: r.fim === "erro" ? "error" : "done" })
      .eq("id", revisor.id);
    return { revisor: revisor.nome, tarefa: tarefa.titulo, resultado: r };
  } catch (e) {
    const motivo = (e as Error).message;
    await supabase.from("agentes").update({ status: "error" }).eq("id", revisor.id);
    await registrarLog(supabase, {
      agente_id: revisor.id,
      tarefa_id: tarefa.id,
      nivel: "erro",
      mensagem: `revisão falhou: ${motivo}`,
    });
    return { revisor: revisor.nome, erro: motivo };
  }
}

async function tentarTrabalhar(
  supabase: ReturnType<typeof supabaseAdmin>,
  time: Agente[],
  tetoPassos: number,
): Promise<Record<string, unknown> | null> {
  for (const agente of time) {
    const tarefa = await pegarProximaTarefa(supabase, agente);
    if (!tarefa) continue;

    await supabase.from("agentes").update({ status: "working" }).eq("id", agente.id);
    await registrarLog(supabase, {
      agente_id: agente.id,
      tarefa_id: tarefa.id,
      nivel: "info",
      mensagem: `peguei "${tarefa.titulo}"`,
    });

    try {
      const prompt = await montarPromptDoAgente(supabase, agente, tarefa);
      const r = await executarPasso(supabase, agente, tarefa, CATALOGO, prompt, tetoPassos);

      if (r.fim === "concluido") {
        // Quem abriu PR já mudou a tarefa para em_revisao; não desfazer isso.
        const { data: atual } = await supabase
          .from("tarefas")
          .select("status")
          .eq("id", tarefa.id)
          .single();

        if (atual?.status === "em_andamento") {
          await concluirTarefa(supabase, tarefa, r.resposta, r.passos);
        }
        await supabase.from("agentes").update({ status: "done" }).eq("id", agente.id);
        return { agente: agente.nome, tarefa: tarefa.titulo, fim: "concluido", passos: r.passos };
      }

      if (r.fim === "continua") {
        await devolverParaFila(supabase, tarefa, r.passos);
        await supabase.from("agentes").update({ status: "working" }).eq("id", agente.id);
        return { agente: agente.nome, tarefa: tarefa.titulo, fim: "continua", passos: r.passos };
      }

      const destino = await falharOuEscalar(supabase, tarefa, agente, r.motivo, r.passos);
      await supabase.from("agentes").update({ status: "error" }).eq("id", agente.id);
      return { agente: agente.nome, tarefa: tarefa.titulo, fim: "erro", destino, motivo: r.motivo };
    } catch (e) {
      const motivo = (e as Error).message;
      const destino = await falharOuEscalar(supabase, tarefa, agente, motivo, tarefa.passos);
      await supabase.from("agentes").update({ status: "error" }).eq("id", agente.id);
      await registrarLog(supabase, {
        agente_id: agente.id,
        tarefa_id: tarefa.id,
        nivel: "erro",
        mensagem: motivo,
      });
      return { agente: agente.nome, erro: motivo, destino };
    }
  }

  return null;
}
