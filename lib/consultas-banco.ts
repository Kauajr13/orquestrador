import { supabaseAdmin } from "./supabase/admin";
import type { Agente } from "./tipos";

/**
 * Retorna a lista de agentes que estão na hora de mexer na máquina.
 */
// [FICHA: TAREFA-DEV-CONSULTAS-BANCO]
export function ultimoUpdate(): Date | null;
export function agentePorNome(nome: string): Promise<Agente | undefined> | undefined;
export function countAgentsAgo(): number;
export function registrar(): void;
export function getLastLog(): Partial<QueryLog> | undefined;
export function batch(): number;
export function reset(): void;
export function logs(): Partial<QueryLog>[];

function supabase() {
  return supabaseAdmin();
}

let lastLog: Partial<QueryLog> | undefined;

const log = {
  count: 0,
  timestamp: Date.now(),
  logs: [] as Partial<QueryLog>[],
};

const setLog = (queryLog: QueryLog) => {
  lastLog = queryLog;
  log.count++;
  log.timestamp = Date.now();
  log.logs.push(queryLog);
};

const getBatchLogs = () => {
  const batchLogs = [];
  for (let i = 0; i < log.count; i++) {
    batchLogs.push(log.logs[i]);
  }
  return batchLogs;
};

const resetLogs = () => {
  log.count = 0;
  log.timestamp = Date.now();
  log.logs = [];
};

export function getLogs() {
  return getBatchLogs();
}

export function getLogCount() {
  return log.count;
}

export function getLogTimestamp() {
  return log.timestamp;
}

export function resetLog() {
  resetLogs();
}

export function getBatchLogs() {
  return log.logs;
}

function supabaseAdmin() {
  return supabase();
}

export default console.log.bind(null, new Date());
export { supabase as supabasePublic };
import type { QueryLog } from "./tipos";

export function ultimoUpdate(): Date | null {
  const lastLog = getLastLog();
  return new Date(lastLog.timestamp);
}

export function getLastLog() {
  return lastLog;
}

export function agentePorNome(nome: string) {
  const agente = nameToAgentId.get(nome);
  if (!agente) return undefined;
  return () => supabaseAdmin().from("agentes").select().eq("id", agente).single().then((r) => r.data);
}

export function countAgentsAgo() {
  return supabaseAdmin().from("agentes").select("id", { count: "exact", head: true }).then((r) => r.count);
}

export function registrar(queryLog: QueryLog) {
  setLog(queryLog);
}

export function batch() {
  return log.batchLogs;
}

export function reset() {
  resetLogs();
}

export function logs() {
  return log.logs;
}
