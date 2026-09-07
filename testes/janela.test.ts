import { describe, expect, it } from "vitest";
import { montarJanela } from "@/lib/agentes/runner";
import type { Mensagem } from "@/lib/tipos";

/**
 * A janela mandava o prompt de sistema DUAS vezes.
 *
 * O early-return tinha `&& !fontes.length`, então com fonte lida e conversa
 * curta ele não disparava — e aí `inicio = slice(0,2)` e `recentes = slice(-4)`
 * se sobrepunham. Acontecia no passo seguinte à primeira busca, que é o passo 2
 * de quase toda tarefa: até 2600 tokens duplicados no momento de orçamento mais
 * apertado. Provável causa do "trava no segundo passo" que perseguimos por
 * várias rodadas.
 */
function conversa(n: number): Mensagem[] {
  const msgs: Mensagem[] = [
    { role: "system", content: "PROMPT_DE_SISTEMA" },
    { role: "user", content: "Tarefa: fazer algo" },
  ];
  for (let i = 0; i < n; i++) {
    msgs.push({ role: "assistant", content: `passo ${i}` });
  }
  return msgs;
}

describe("janela da conversa", () => {
  it("nunca repete o prompt de sistema", () => {
    for (let n = 0; n <= 10; n++) {
      for (const fontes of [[], [{ url: "https://x.com", texto: "t" }]]) {
        const saida = montarJanela(conversa(n), fontes);
        const vezes = saida.filter(
          (m) => m.role === "system" && m.content === "PROMPT_DE_SISTEMA",
        ).length;
        expect(vezes, `n=${n}, fontes=${fontes.length}`).toBe(1);
      }
    }
  });

  it("o caso exato que quebrava: conversa curta com fonte lida", () => {
    const saida = montarJanela(conversa(2), [{ url: "https://x.com", texto: "t" }]);
    const conteudos = saida.map((m) => m.content);
    expect(conteudos.filter((c) => c === "PROMPT_DE_SISTEMA")).toHaveLength(1);
    expect(conteudos.filter((c) => c === "Tarefa: fazer algo")).toHaveLength(1);
  });

  it("mantém o começo e as mensagens recentes numa conversa longa", () => {
    const saida = montarJanela(conversa(12), []);
    expect(saida[0].content).toBe("PROMPT_DE_SISTEMA");
    expect(saida[saida.length - 1].content).toBe("passo 11");
  });

  it("lista as fontes lidas para o agente não buscar de novo", () => {
    const saida = montarJanela(conversa(8), [
      { url: "https://exemplo.com/a", texto: "t" },
    ]);
    expect(JSON.stringify(saida)).toContain("https://exemplo.com/a");
  });
});
