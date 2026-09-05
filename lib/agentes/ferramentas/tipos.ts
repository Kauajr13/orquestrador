import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agente, NivelLog, Tarefa } from "@/lib/tipos";

/**
 * O que uma ferramenta enxerga quando roda. Tudo que ela precisa vem daqui —
 * nenhuma ferramenta lê `process.env` por conta própria, porque é assim que
 * segredo vaza pra dentro de um prompt (regra 10 da constituição).
 */
export type Contexto = {
  supabase: SupabaseClient;
  agente: Agente;
  tarefa: Tarefa | null;
  /** Fontes lidas nesta execução, usadas depois pela checagem de originalidade. */
  fontesLidas: { url: string; texto: string }[];
  /**
   * Skills que o agente efetivamente carregou neste passo. É assim que
   * `publicar_pagina` sabe se o texto passou pelo `humanizer`: a trava não
   * confia na palavra do agente, confia no registro do que ele leu.
   */
  skillsCarregadas: Set<string>;
  registrar(nivel: NivelLog, mensagem: string): Promise<void>;
};

export type Ferramenta = {
  nome: string;
  descricao: string;
  /** JSON Schema dos argumentos, no formato que a API de chat espera. */
  parametros: Record<string, unknown>;
  /**
   * Ferramenta que gasta dinheiro de verdade. Com saldo zero em caixa, o runner
   * recusa antes de executar — regra 6 da constituição. Hoje nenhuma gasta; o
   * campo existe porque a primeira que gastar não pode depender de alguém
   * lembrar de checar.
   */
  custa?: boolean;
  executar(argumentos: Record<string, unknown>, ctx: Contexto): Promise<string>;
};

/** Erro que a ferramenta devolve ao modelo em vez de derrubar o tick. */
export class ErroDeFerramenta extends Error {}
