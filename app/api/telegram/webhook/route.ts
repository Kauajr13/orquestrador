import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * As respostas do chefe.
 *
 * Aqui chegam os botões: aprovar ou recusar uma migration, e pausar o
 * escritório inteiro. É a única porta pela qual uma decisão humana entra no
 * sistema em tempo real.
 *
 * Por isso o `secret_token`: sem ele, qualquer pessoa que descobrisse a URL
 * poderia aprovar uma migration ou destravar o expediente. O Telegram manda
 * esse cabeçalho em todo update quando ele é configurado no setWebhook.
 */
export async function POST(req: Request) {
  const segredo = process.env.TELEGRAM_WEBHOOK_SECRET;
  const recebido = req.headers.get("x-telegram-bot-api-secret-token");

  if (!segredo || recebido !== segredo) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as {
    callback_query?: {
      id: string;
      data?: string;
      from?: { id: number };
    };
    message?: { text?: string; chat?: { id: number } };
  } | null;

  if (!update) return NextResponse.json({ ok: true });

  const supabase = supabaseAdmin();
  const chatEsperado = process.env.TELEGRAM_CHAT_ID;

  // Botão apertado
  if (update.callback_query?.data) {
    const quem = String(update.callback_query.from?.id ?? "");
    if (chatEsperado && quem !== chatEsperado) {
      return NextResponse.json({ ok: true });
    }

    const [assunto, acao, alvo] = update.callback_query.data.split(":");

    if (assunto === "migration" && alvo) {
      const aprovado = acao === "aprovar";
      await supabase.from("aprovacoes").upsert(
        {
          pr_numero: Number(alvo),
          aprovado,
          motivo: aprovado ? "aprovado pelo chefe no Telegram" : "recusado pelo chefe",
          decidido_em: new Date().toISOString(),
        },
        { onConflict: "pr_numero" },
      );

      await enviarTelegram(
        aprovado
          ? `Migration do PR #${alvo} liberada. O Revisor segue daqui.`
          : `Migration do PR #${alvo} recusada. O Dev vai receber o recado.`,
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  // Comandos de texto
  const texto = update.message?.text?.trim().toLowerCase();
  const chat = String(update.message?.chat?.id ?? "");
  if (!texto || (chatEsperado && chat !== chatEsperado)) {
    return NextResponse.json({ ok: true });
  }

  if (texto === "/pausar" || texto === "/parar") {
    await supabase
      .from("config")
      .upsert({ chave: "pausado", valor: "true" }, { onConflict: "chave" });
    await enviarTelegram("Escritório pausado. Ninguém trabalha até você mandar voltar.");
  } else if (texto === "/voltar" || texto === "/retomar") {
    await supabase
      .from("config")
      .upsert({ chave: "pausado", valor: "false" }, { onConflict: "chave" });
    await enviarTelegram("Escritório de volta ao trabalho.");
  } else if (texto === "/status") {
    const [{ count: pendentes }, { count: travadas }] = await Promise.all([
      supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("status", "bloqueada"),
    ]);
    await enviarTelegram(
      `${pendentes ?? 0} tarefa(s) na fila, ${travadas ?? 0} travada(s) esperando você.`,
    );
  }

  return NextResponse.json({ ok: true });
}
