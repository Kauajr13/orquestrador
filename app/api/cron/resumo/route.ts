import { NextResponse } from "next/server";
import { saldoDisponivel } from "@/lib/caixa";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarTelegram, telegramConfigurado } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * O fechamento do dia, no Telegram.
 *
 * O resto do sistema só fala com o chefe por exceção — quando trava, quando
 * precisa de providência. Isso é certo para não virar ruído, mas deixa uma
 * lacuna: sem nenhum sinal, não dá para distinguir "trabalhou o dia todo e está
 * indo bem" de "está parado há três dias e ninguém percebeu". Este resumo fecha
 * essa lacuna com uma mensagem por dia.
 *
 * Roda às 21h30 UTC, 18h30 em Brasília, logo depois do expediente fechar.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const segredo = process.env.CRON_SECRET;
  if (!segredo || auth !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  if (!telegramConfigurado()) {
    return NextResponse.json({ ok: true, feito: "nada", motivo: "Telegram não configurado" });
  }

  const supabase = supabaseAdmin();

  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(0, 0, 0, 0);
  const desde = inicioDoDia.toISOString();

  const inicioDoMes = new Date();
  inicioDoMes.setUTCDate(1);
  inicioDoMes.setUTCHours(0, 0, 0, 0);

  const [tarefas, execucoesHoje, execucoesMes, metas, agentes, memoria, diario, saldo] =
    await Promise.all([
      supabase.from("tarefas").select("titulo, status, pr_numero, concluido_em, escalada_para"),
      supabase.from("execucoes").select("tokens_entrada, tokens_saida").gte("criado_em", desde),
      supabase
        .from("execucoes")
        .select("custo_estimado")
        .gte("criado_em", inicioDoMes.toISOString()),
      supabase.from("metas").select("titulo, ordem, evidencia, atingida").eq("ativa", true),
      supabase.from("agentes").select("nome, papel").eq("ativo", true),
      supabase.from("memoria").select("chave").gte("atualizado_em", desde),
      supabase.from("diario").select("texto, agente_id").eq("dia", desde.slice(0, 10)),
      saldoDisponivel(supabase),
    ]);

  const lista = tarefas.data ?? [];
  const concluidasHoje = lista.filter(
    (t) => t.status === "concluida" && t.concluido_em && t.concluido_em >= desde,
  );
  const travadas = lista.filter((t) => t.status === "bloqueada");
  const naFila = lista.filter((t) => t.status === "pendente");
  const emRevisao = lista.filter((t) => t.status === "em_revisao");

  const tokensHoje = (execucoesHoje.data ?? []).reduce(
    (s, e) => s + Number(e.tokens_entrada ?? 0) + Number(e.tokens_saida ?? 0),
    0,
  );
  const custoMes = (execucoesMes.data ?? []).reduce(
    (s, e) => s + Number(e.custo_estimado ?? 0),
    0,
  );

  // Projeção simples: o gasto do mês até agora, esticado até o fim dele. Serve
  // para o Kauã ver o tamanho da conta antes de ela existir, agora que o
  // provedor é gratuito.
  const diaDoMes = new Date().getUTCDate();
  const diasNoMes = new Date(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth() + 1,
    0,
  ).getDate();
  const projecao = diaDoMes > 0 ? (custoMes / diaDoMes) * diasNoMes : 0;

  const meta = (metas.data ?? [])[0];
  const trabalhou = tokensHoje > 0;

  const linhas: string[] = [
    `*Fechamento do dia* — ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    "",
  ];

  if (!trabalhou) {
    linhas.push(
      "Ninguém trabalhou hoje. Se isso se repetir amanhã, alguma coisa está travada — vale olhar o painel.",
      "",
    );
  } else {
    linhas.push(
      `${concluidasHoje.length} tarefa(s) concluída(s), ${tokensHoje.toLocaleString("pt-BR")} tokens gastos.`,
    );
    if (concluidasHoje.length) {
      linhas.push(...concluidasHoje.slice(0, 5).map((t) => `• ${t.titulo}`));
    }
    if (memoria.data?.length) {
      linhas.push(`Aprendeu: ${memoria.data.map((m) => m.chave).join(", ")}`);
    }
    linhas.push("");
  }

  if (meta) {
    linhas.push(
      `*Meta ${meta.ordem} de 4:* ${meta.titulo}`,
      meta.evidencia
        ? `_${String(meta.evidencia).slice(0, 300)}_`
        : "_Sem evidência de progresso ainda._",
      "",
    );
  }

  linhas.push(
    `Fila: ${naFila.length} · Em revisão: ${emRevisao.length} · Travadas: ${travadas.length}`,
    `Time: ${(agentes.data ?? []).length} funcionário(s)`,
  );

  if (travadas.length) {
    linhas.push("", "*Esperando você:*", ...travadas.slice(0, 3).map((t) => `• ${t.titulo}`));
  }

  linhas.push(
    "",
    `Custo do mês a preço de mercado: US$ ${custoMes.toFixed(2)} (projeção do mês fechado: US$ ${projecao.toFixed(2)})`,
    `Caixa: R$ ${saldo.toFixed(2)}`,
  );

  const doDiario = diario.data ?? [];
  if (doDiario.length) {
    linhas.push("", "*Do diário:*", ...doDiario.slice(0, 3).map((d) => `_${d.texto}_`));
  }

  await enviarTelegram(linhas.join("\n"));

  return NextResponse.json({
    ok: true,
    feito: "resumo enviado",
    concluidas: concluidasHoje.length,
    tokens: tokensHoje,
    travadas: travadas.length,
  });
}
