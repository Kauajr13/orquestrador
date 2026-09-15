/**
 * Utilidades para leitura de logs por agente, usadas pela rotina de
 * retrospectiva semanal. A forma canônica que o resumo espera é
 * `{ agente, texto, tipo, data }` — mapeamos o nome do banco para ela aqui.
 * Assinatura conforme a tarefa: buscarLogsDaSemana(agente, inicio, fim).
 */

/** Níveis possíveis no banco de logs. */
export type TipoLog = "info" | "warn" | "error" | (string & {});

/** Um log da semana, na forma do resumo semanal. */
export interface Log {
  agente: string;
  texto: string;
  tipo: TipoLog;
  data: string; // ISO-8601, como registrado pelo banco
}


type LogBanco = {
  id: string;
  agente_id: string;
  tarefa_id: string | null;
  nivel: TipoLog;
  mensagem: string;
  criado_em: string;
};

/**
 * Busca os logs de um agente entre `inicio` e `fim` (inclusive), na ordem
 * cronológica. Retorna vazio se o agente não existir ou não tiver logs no
 * período — quem chama pode iterar com `for...of` sem guard.
 *
 * @param agente - id do agente no banco (`agente_id`) ou, se a empresa mudar
 *                 para nome legível, o valor que for aceito pelo filtro do banco
 * @param inicio - início do período (inclusive)
 * @param fim - fim do período (inclusive)
 */
export async function buscarLogsDaSemana(
  agente: string,
  inicio: Date,
  fim: Date
): Promise<Log[]> {
  if (!agente || !agente.length) {
    throw new Error("buscarLogsDaSemana: agente é obrigatório");
  }

  // A camada de infra joga o cabeçalho de autenticação da empresa no fetch;
  // aqui só pedimos o que queremos.
  const res = await fetch(
    `/api/banco/logs?agente_id=${encodeURIComponent(agente)}&de=${inicio.toISOString()}&ate=${fim.toISOString()}&ordem=asc&limite=500`
  );

  if (!res.ok) {
    throw new Error(
      `buscarLogsDaSemana: banco respondeu ${res.status} para agente ${agente}`
    );
  }

  const logs: LogBanco[] = await res.json();

  // Defensivo se o banco resolver filtrar no cliente no futuro.
  const inicioMs = inicio.getTime();
  const fimMs = fim.getTime();

  return logs
    .filter((l) => {
      const t = new Date(l.criado_em).getTime();
      return t >= inicioMs && t <= fimMs;
    })
    .map((l) => ({
      agente: l.agente_id,
      texto: l.mensagem,
      tipo: l.nivel,
      data: l.criado_em,
    }));
}
