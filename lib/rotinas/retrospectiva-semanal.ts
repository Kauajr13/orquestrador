
import { pausarAutomatica } from './pausa-automatica';

export async function executarRetrospectivaSemanal(): Promise<void> {
  // Etapa 1: coletar dados necessários para a retrospectiva
  const dados = await coletarDadosRetrospectiva();

  // Etapa 2: gerar relatório a partir dos dados coletados
  await gerarRelatorioRetrospectiva(dados);

  // Etapa 3: pausar automaticamente a rotina, se necessário,
  // interrompendo e registrando a pausa após o envio do relatório
  await pausarAutomatica();
}

/**
 * Coleta os dados relevantes da semana corrente.
 * Atualmente é um stub que retorna um objeto vazio.
 * Futuras implementações deverão buscar informações no banco,
 * analisar progresso nas metas e outros indicadores.
 */
async function coletarDadosRetrospectiva(): Promise<Record<string, unknown>> {
  // TODO: integrar com camada de persistência para obter dados reais
  return {};
}

/**
 * Gera e persiste o relatório da retrospectiva semanal.
 * Este stub apenas simula a operação.
 */
async function gerarRelatorioRetrospectiva(dados: Record<string, unknown>): Promise<void> {
  // TODO: transformar `dados` em relatório (por exemplo, PDF, markdown) e salvar
  // Por enquanto, nenhuma ação concreta.
  return;
}
