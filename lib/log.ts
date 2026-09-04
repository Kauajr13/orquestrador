import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivelLog } from "@/lib/tipos";

/**
 * Escreve no terminal do escritório. A tabela `logs` está na publicação do
 * Realtime, então o painel recebe cada linha sem polling — é literalmente o que
 * aparece piscando na tela enquanto os agentes trabalham.
 *
 * Nunca falha o trabalho por causa de log: se a escrita der erro, a tarefa
 * continua. Perder uma linha de log é chato; perder um passo de agente por
 * causa dela seria burrice.
 */
export async function registrarLog(
  supabase: SupabaseClient,
  entrada: {
    agente_id?: string | null;
    tarefa_id?: string | null;
    nivel?: NivelLog;
    mensagem: string;
  },
): Promise<void> {
  try {
    await supabase.from("logs").insert({
      agente_id: entrada.agente_id ?? null,
      tarefa_id: entrada.tarefa_id ?? null,
      nivel: entrada.nivel ?? "info",
      mensagem: entrada.mensagem.slice(0, 2000),
    });
  } catch (e) {
    console.error("falhou ao registrar log:", (e as Error).message);
  }
}
