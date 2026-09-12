import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { falharOuEscalar } from "@/lib/agentes/hierarquia";
import { agenteFake, tarefaFake } from "./apoio";

/**
 * A retentativa precisa dar um orçamento de passos NOVO, não devolver o
 * agente pra fila já estourado.
 *
 * O bug real, encontrado em 12/09/2026 auditando por que toda tarefa grande
 * escalava sempre com a mesma mensagem: quando `executarPasso` bate no teto,
 * `tarefa.passos` já é igual ao teto — é assim que ele chega aqui. Gravar esse
 * mesmo número de volta na retentativa fazia o primeiro passo da tentativa
 * seguinte encontrar `passos >= tetoPassos` de novo, ANTES de chamar o modelo.
 * `carregarOuCriarExecucao` abre conversa nova a cada retentativa — mas sem
 * zerar `passos`, essa conversa nova nunca chegava a rodar. Na prática,
 * `TENTATIVAS_ATE_ESCALAR = 3` dava uma chance real e duas falhas automáticas,
 * e a única tarefa que sobrevivia às 3 tentativas era a que cabia inteira
 * dentro do teto na primeira tentativa — ou seja, nenhuma tarefa grande.
 */

/** Captura os argumentos de `.update(...)` sem depender do supabaseFake genérico. */
function supabaseCapturaUpdate() {
  const chamadas: Record<string, unknown>[] = [];
  const encadeavel = {
    update: (valores: Record<string, unknown>) => {
      chamadas.push(valores);
      return encadeavel;
    },
    eq: () => Promise.resolve({ data: null, error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
  };
  const supabase = { from: () => encadeavel } as unknown as SupabaseClient;
  return { supabase, chamadas };
}

describe("retentativa depois de estourar o teto de passos", () => {
  it("zera passos ao repetir, em vez de devolver a tarefa já no teto", async () => {
    const { supabase, chamadas } = supabaseCapturaUpdate();
    const tarefa = tarefaFake({ tentativas: 0, passos: 40 });
    const agente = agenteFake();

    const destino = await falharOuEscalar(
      supabase,
      tarefa,
      agente,
      "estourou o teto de 40 passos sem concluir",
      40,
    );

    expect(destino).toBe("repetir");
    // A primeira chamada de update é a que devolve a tarefa pra fila.
    expect(chamadas[0]).toMatchObject({ status: "pendente", tentativas: 1, passos: 0 });
  });

  it("zera de novo na segunda tentativa", async () => {
    const { supabase, chamadas } = supabaseCapturaUpdate();
    const tarefa = tarefaFake({ tentativas: 1, passos: 40 });

    await falharOuEscalar(supabase, tarefa, agenteFake(), "estourou de novo", 40);

    expect(chamadas[0]).toMatchObject({ status: "pendente", tentativas: 2, passos: 0 });
  });

  it("na terceira falha, escala em vez de repetir — e não zera mais nada", async () => {
    const { supabase, chamadas } = supabaseCapturaUpdate();
    const tarefa = tarefaFake({ tentativas: 2, passos: 40 });
    const agente = agenteFake({ superior_id: "gestor-1" });

    const destino = await falharOuEscalar(supabase, tarefa, agente, "estourou pela terceira vez", 40);

    expect(destino).toBe("escalada");
    expect(chamadas[0]).toMatchObject({ status: "bloqueada", tentativas: 3, passos: 40 });
  });
});
