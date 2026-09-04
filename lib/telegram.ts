import type { SupabaseClient } from "@supabase/supabase-js";
import { dentroDoExpediente, type Config } from "./agentes/jornada";

/**
 * O canal com o chefe.
 *
 * A regra do canal é horário, não urgência do remetente: uma mensagem gerada às
 * 3h da manhã fica represada e sai às 8h. O Kauã pediu para ser chamado em
 * horário comercial, e um pedido de providência não fica melhor por acordar
 * alguém — fica pior, porque treina a pessoa a silenciar o aplicativo.
 *
 * A única exceção é `critica`: credencial vencida, provedor fora do ar, coisas
 * que param o escritório inteiro. Essas furam o silêncio, porque esperar até as
 * 8h significa perder a noite inteira de trabalho.
 */

type Botao = { texto: string; dado: string };

export function telegramConfigurado(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function enviarTelegram(texto: string, botoes: Botao[] = []): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("Telegram não configurado");

  const corpo: Record<string, unknown> = {
    chat_id: chat,
    text: texto.slice(0, 4000),
    parse_mode: "Markdown",
  };

  if (botoes.length) {
    corpo.reply_markup = {
      inline_keyboard: [botoes.map((b) => ({ text: b.texto, callback_data: b.dado }))],
    };
  }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
  });

  if (!r.ok) {
    throw new Error(`Telegram HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

/**
 * Esvazia a fila. Fora do expediente só passa o que é crítico; o resto espera.
 * As normais saem agrupadas, para o Kauã ler uma mensagem de manhã em vez de
 * catorze.
 */
export async function despacharNotificacoes(
  supabase: SupabaseClient,
  cfg: Config,
): Promise<number> {
  if (!telegramConfigurado()) return 0;

  const { data: pendentes } = await supabase
    .from("notificacoes")
    .select("*")
    .is("enviada_em", null)
    .order("criado_em", { ascending: true })
    .limit(20);

  if (!pendentes?.length) return 0;

  const expediente = dentroDoExpediente(cfg);
  const aEnviar = expediente ? pendentes : pendentes.filter((n) => n.urgencia === "critica");
  if (!aEnviar.length) return 0;

  const criticas = aEnviar.filter((n) => n.urgencia === "critica");
  const normais = aEnviar.filter((n) => n.urgencia !== "critica");

  for (const n of criticas) {
    await enviarTelegram(`🔴 *Crítico*\n\n${n.texto}`);
  }

  if (normais.length) {
    const texto =
      normais.length === 1
        ? normais[0].texto
        : `*${normais.length} avisos do escritório*\n\n` +
          normais.map((n, i) => `${i + 1}. ${n.texto}`).join("\n\n");

    // Aprovação de migration precisa de botão: é decisão, não recado.
    const migration = normais.find((n) => n.texto.includes("esperando seu OK"));
    const numeroPR = migration?.texto.match(/PR #(\d+)/)?.[1];

    await enviarTelegram(
      texto,
      numeroPR
        ? [
            { texto: "Aprovar migration", dado: `migration:aprovar:${numeroPR}` },
            { texto: "Recusar", dado: `migration:recusar:${numeroPR}` },
          ]
        : [],
    );
  }

  const ids = aEnviar.map((n) => n.id);
  await supabase
    .from("notificacoes")
    .update({ enviada_em: new Date().toISOString() })
    .in("id", ids);

  return ids.length;
}
