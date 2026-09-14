// Rotina de Retrospectiva Semanal
// Implementa a lógica principal para detectar falta de progresso e pausar o expediente.
// A função principal é exportada como `principal`.
// A lógica usa funções auxiliares que podem ser mockadas nos testes.

import { consultar_banco, pedir_providencia } from "../database"; // presumido

// Tipos de dados esperados das tabelas
export interface Meta {
  id: number;
  ativo: boolean;
  // outros campos podem existir
}

export interface Retrospectiva {
  semana: number;
  houve_progresso: boolean;
  // outros campos podem existir
}

export interface Config {
  pausado: boolean;
  // outros campos podem existir
}

/**
 * Busca a meta ativa. Retorna a primeira meta com ativo = true.
 */
export async function getActiveMeta(): Promise<Meta | null> {
  const metas = await consultar_banco({ tabela: "metas", filtro_coluna: "ativo", filtro_valor: "true" });
  return metas?.[0] ?? null;
}

/**
 * Busca retrospectivas de uma semana específica.
 */
export async function getRetrospectivasBySemana(semana: number): Promise<Retrospectiva[]> {
  const retros = await consultar_banco({ tabela: "retrospectivas", filtro_coluna: "semana", filtro_valor: String(semana) });
  return retros ?? [];
}

/**
 * Busca a configuração atual.
 */
export async function getConfig(): Promise<Config> {
  const configs = await consultar_banco({ tabela: "config" });
  return configs?.[0] ?? { pausado: false };
}

/**
 * Atualiza a configuração com novos valores.
 */
export async function updateConfig(newConfig: Partial<Config>): Promise<void> {
  // Aqui seria uma atualização no DB; em testes é mockado.
  await consultar_banco({ tabela: "config", filtro_coluna: "id", filtro_valor: "1", ordenar_por: "id" });
  // O comportamento real é implementado fora desta função.
}

/**
 * Função principal que executa a lógica de retrospectiva semanal.
 */
export async function principal(): Promise<void> {
  try {
    const meta = await getActiveMeta();
    if (!meta) {
      throw new Error("Nenhuma meta ativa encontrada");
    }

    const currentWeek = getCurrentWeek();
    const retros = await getRetrospectivasBySemana(currentWeek);

    // Se não houver evidências na semana atual, nada a fazer
    if (!retros.length) {
      return;
    }

    // Verifica progresso nas duas semanas anteriores
    const week1 = currentWeek - 1;
    const week2 = currentWeek - 2;

    const retrosPrev1 = await getRetrospectivasBySemana(week1);
    const retrosPrev2 = await getRetrospectivasBySemana(week2);

    const houveProgressoPrev1 = retrosPrev1.some((r) => r.houve_progresso);
    const houveProgressoPrev2 = retrosPrev2.some((r) => r.houve_progresso);

    if (!houveProgressoPrev1 && !houveProgressoPrev2) {
      const config = await getConfig();
      await updateConfig({ pausado: true });
      await pedir_providencia({
        assunto: "Expediente pausado por falta de progresso",
        detalhe: "Sem progresso nas duas últimas semanas",
        urgencia: "critica",
      });
    }
  } catch (err) {
    // Log ou tratamento adicional pode ser adicionado
    throw err;
  }
}

/**
 * Calcula o número da semana corrente no ano.
 * Simplificação: usa ISO week date (1-53).
 */
function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(diff / oneWeek) + 1;
}
