import type { Meta } from "@/lib/tipos";
import { consultar_banco } from "@/lib/banco";

/**
 * Executa a retrospectiva semanal, consultando a meta ativa e seu progresso.
 * 
 * @returns Promessa com os dados da meta ativa e seu progresso (atingida e evidencia)
 * @throws Erro se não houver meta ativa ou se a consulta falhar
 */
export async function executarRetrospectivaSemanal(): Promise<{
  meta: Meta;
  progresso: {
    atingida: boolean;
    evidencia: string | null;
  };
}> {
  // 1. Consultar a meta ativa
  const metasAtivas = await consultar_banco({
    tabela: "metas",
    filtro_coluna: "ativa",
    filtro_valor: "true",
    limite: 1,
  });

  if (!metasAtivas || metasAtivas.length === 0) {
    throw new Error("Nenhuma meta ativa encontrada.");
  }

  const metaAtiva = metasAtivas[0] as Meta;

  // 2. Verificar o progresso da meta ativa
  const progresso = {
    atingida: metaAtiva.atingida,
    evidencia: metaAtiva.evidencia,
  };

  return {
    meta: metaAtiva,
    progresso,
  };
}
