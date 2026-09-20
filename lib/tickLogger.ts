/**
 * Módulo de log para tick.
 *
 * Passo 1: criar a função exportável `exportarLastTick` como stub, para que
 * outros modules possam já referenciar sem quebrar. A persistência real no
 * banco `consultas-banco` é adicionada em PR subsequente.
 */

// Dado aceito de por um tick que foi finalizado e precisa ser exportado
// ao respectivo registro no banco.
// `any` de propósito por enquanto — a forma estruturada de tick será
// escolhida junto com a implementação real.
export async function exportarLastTick(tickData: any): Promise<void> {
  console.log('exportarLastTick chamado', tickData);
  // TODO(seguranca): persistir `tickData` em `consultas-banco`.
  // Por ora só loga e retorna — o contrato de assinatura já está estabelecido.
}
