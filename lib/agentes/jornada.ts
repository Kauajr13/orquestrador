import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O expediente. Agente que trabalha 24h por dia não é mais produtivo — é mais
 * caro e mais difícil de acompanhar. O Kauã pediu jornada com hora para começar,
 * hora para parar e descanso ao terminar a tarefa, e é isso que mora aqui.
 */

export type Config = Map<string, string>;

export async function lerConfig(supabase: SupabaseClient): Promise<Config> {
  const { data, error } = await supabase.from("config").select("chave, valor");
  if (error) throw new Error(`não consegui ler config: ${error.message}`);
  return new Map((data ?? []).map((l) => [l.chave as string, l.valor as string]));
}

export function numero(cfg: Config, chave: string, padrao: number): number {
  const v = Number(cfg.get(chave));
  return Number.isFinite(v) ? v : padrao;
}

/**
 * Regra 1 da constituição. É o botão de emergência, e precisa funcionar mesmo
 * quando todo o resto estiver quebrado — por isso é a primeira coisa que o tick
 * pergunta, antes de qualquer outra leitura.
 */
export function estaPausado(cfg: Config): boolean {
  return cfg.get("pausado") === "true";
}

/** Hora local no fuso da empresa, sem depender do fuso do servidor. */
export function horaLocal(cfg: Config, agora = new Date()): number {
  const fuso = cfg.get("fuso") ?? "America/Sao_Paulo";
  const h = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "numeric",
    hour12: false,
  }).format(agora);
  return Number(h);
}

export function dentroDoExpediente(cfg: Config, agora = new Date()): boolean {
  const h = horaLocal(cfg, agora);
  const inicio = numero(cfg, "expediente_inicio", 8);
  const fim = numero(cfg, "expediente_fim", 18);
  return h >= inicio && h < fim;
}

/**
 * Teto diário de tarefas e de tokens. Estourou, todo mundo descansa até amanhã.
 * Existe para o dia em que a promoção de tokens acabar e para o caso de um
 * agente confuso decidir trabalhar em círculos.
 */
export async function tetoDiarioAtingido(
  supabase: SupabaseClient,
  cfg: Config,
): Promise<{ atingido: boolean; motivo?: string }> {
  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(0, 0, 0, 0);
  const desde = inicioDoDia.toISOString();

  const { count: tarefas } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .gte("concluido_em", desde);

  const limiteTarefas = numero(cfg, "teto_tarefas_dia", 20);
  if ((tarefas ?? 0) >= limiteTarefas) {
    return { atingido: true, motivo: `teto de ${limiteTarefas} tarefas no dia` };
  }

  const { data: execucoes } = await supabase
    .from("execucoes")
    .select("tokens_entrada, tokens_saida")
    .gte("criado_em", desde);

  const tokens = (execucoes ?? []).reduce(
    (soma, e) => soma + Number(e.tokens_entrada ?? 0) + Number(e.tokens_saida ?? 0),
    0,
  );
  const limiteTokens = numero(cfg, "teto_tokens_dia", 5_000_000);
  if (tokens >= limiteTokens) {
    return {
      atingido: true,
      motivo: `teto de ${limiteTokens.toLocaleString("pt-BR")} tokens no dia`,
    };
  }

  return { atingido: false };
}

/**
 * Freio de gasto do mês.
 *
 * Enquanto o provedor era gratuito, o custo era só um número na tela. Com
 * provedor pago vira dinheiro do Kauã, e um agente em laço consegue queimar um
 * mês inteiro de orçamento numa madrugada sem ninguém ver.
 *
 * Para o expediente ao chegar no teto, e avisa uma vez ao passar de 80% — o
 * aviso importa mais que o corte, porque dá tempo de decidir antes de parar.
 */
export async function tetoDeGastoAtingido(
  supabase: SupabaseClient,
  cfg: Config,
): Promise<{ atingido: boolean; motivo?: string; alerta?: string }> {
  const teto = numero(cfg, "teto_gasto_mes_usd", 5);
  if (teto <= 0) return { atingido: false };

  const inicioDoMes = new Date();
  inicioDoMes.setUTCDate(1);
  inicioDoMes.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("execucoes")
    .select("custo_estimado")
    .gte("criado_em", inicioDoMes.toISOString());

  const gasto = (data ?? []).reduce((s, e) => s + Number(e.custo_estimado ?? 0), 0);

  if (gasto >= teto) {
    return {
      atingido: true,
      motivo: `teto de gasto do mês atingido: US$ ${gasto.toFixed(2)} de US$ ${teto.toFixed(2)}`,
    };
  }

  if (gasto >= teto * 0.8) {
    return {
      atingido: false,
      alerta: `Gasto do mês em US$ ${gasto.toFixed(2)}, de um teto de US$ ${teto.toFixed(2)}. No ritmo atual o expediente para antes do fim do mês.`,
    };
  }

  return { atingido: false };
}
