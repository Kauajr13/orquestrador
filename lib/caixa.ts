import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Regra 6 da constituição: a empresa não gasta o que não ganhou.
 *
 * O Kauã decidiu que a empresa começa sem gastar nada e só pode usar dinheiro
 * depois de gerar lucro. Isso está aqui como código, e não como frase no prompt,
 * porque instrução em prompt é sugestão — o modelo pode ignorar, interpretar
 * torto ou ser convencido a contornar. Uma função que devolve `false` não pode.
 */
export async function saldoDisponivel(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from("caixa").select("tipo, valor");
  if (error) throw new Error(`não consegui ler o caixa: ${error.message}`);

  return (data ?? []).reduce((saldo, l) => {
    const valor = Number(l.valor ?? 0);
    return l.tipo === "receita" ? saldo + valor : saldo - valor;
  }, 0);
}

export async function podeGastar(
  supabase: SupabaseClient,
  quanto = 0,
): Promise<{ pode: boolean; saldo: number }> {
  const saldo = await saldoDisponivel(supabase);
  return { pode: saldo > 0 && saldo >= quanto, saldo };
}
