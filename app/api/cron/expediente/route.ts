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
  tetoDeGastoAtingido,
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
// No App Router o teto de duração se declara aqui, e não no bloco `functions`
// do vercel.json — aquele só enxerga funções na pasta `api/` fora do framework,
// e apontar para um route.ts faz o build inteiro falhar.
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

  // Dinheiro de verdade tem freio próprio: um agente em laço queima o mês numa
  // madrugada, e o teto diário de tokens não pega isso porque é por dia.
  const gasto = await tetoDeGastoAtingido(supabase, cfg);
  if (gasto.atingido) {
    await supabase.from("agentes").update({ status: "descansando" }).eq("ativo", true);
    await supabase.from("notificacoes").insert({
      texto: `Expediente parado: ${gasto.motivo}. Para liberar, aumente teto_gasto_mes_usd na tabela config.`,
      urgencia: "critica",
    });
    return NextResponse.json({ ok: true, feito: "nada", motivo: gasto.motivo, enviadas });
  }
  if (gasto.alerta) {
    // Um aviso por dia basta. Sem esta checagem o alerta iria a cada tick, o
    // que treina o Kauã a ignorar a notificação justamente quando ela importa.
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: jaAvisou } = await supabase
      .from("notificacoes")
      .select("id")
      .gte("criado_em", `${hoje}T00:00:00Z`)
      .ilike("texto", "Gasto do mês%")
      .limit(1);
    if (!jaAvisou?.length) {
      await supabase.from("notificacoes").insert({ texto: gasto.alerta, urgencia: "normal" });
    }
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

/**
 * Ordena o time por quem está parado há mais tempo.
 *
 * Sem isto o primeiro da lista monopoliza a empresa: o tick percorre os agentes
 * em ordem e para no primeiro que pega tarefa, e o Gestor — criado primeiro e
 * dono da fila inteira — nunca deixava sobrar um tick para o Dev. Ele podia
 * delegar à vontade que o trabalho delegado não sairia do lugar.
 *
 * Quem trabalhou mais recentemente vai para o fim. Quem nunca trabalhou vem
 * primeiro, o que também faz um recém-contratado começar rápido em vez de
 * esperar a vez atrás de quem já está ocupado.
 */
export async function porOciosidade(
  supabase: ReturnType<typeof supabaseAdmin>,
  time: Agente[],
): Promise<Agente[]> {
  const { data } = await supabase
    .from("execucoes")
    .select("agente_id, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);

  const ultimaVez = new Map<string, string>();
  for (const e of data ?? []) {
    const id = e.agente_id as string;
    if (!ultimaVez.has(id)) ultimaVez.set(id, e.criado_em as string);
  }

  return [...time].sort((a, b) => {
    const va = ultimaVez.get(a.id) ?? "";
    const vb = ultimaVez.get(b.id) ?? "";
    return va.localeCompare(vb);
  });
}

async function tentarTrabalhar(
  supabase: ReturnType<typeof supabaseAdmin>,
  timeBruto: Agente[],
  tetoPassos: number,
): Promise<Record<string, unknown> | null> {
  const time = await porOciosidade(supabase, timeBruto);

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
        // Continuar sem ter dado nenhum passo quer dizer que o tick inteiro foi
        // gasto batendo em alguma parede — cota, teto de tokens, provedor fora
        // do ar. Uma vez é normal e o próximo tick resolve; muitas vezes
        // seguidas é uma tarefa presa em laço, e ficaria assim para sempre sem
        // ninguém perceber. Depois de algumas, sobe para o superior.
        if (r.passos === tarefa.passos) {
          const travas = tarefa.tentativas + 1;
          if (travas >= 5) {
            await falharOuEscalar(
              supabase,
              tarefa,
              agente,
              "cinco ticks seguidos sem conseguir avançar um passo — provavelmente a conversa ficou grande demais para o teto do provedor",
              r.passos,
            );
            await supabase.from("agentes").update({ status: "error" }).eq("id", agente.id);
            return { agente: agente.nome, tarefa: tarefa.titulo, fim: "presa" };
          }
          await supabase
            .from("tarefas")
            .update({ status: "pendente", tentativas: travas, lock_ate: null })
            .eq("id", tarefa.id);
          return { agente: agente.nome, tarefa: tarefa.titulo, fim: "sem_avanco", travas };
        }

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
