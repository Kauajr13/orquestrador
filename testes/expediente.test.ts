import { describe, expect, it } from "vitest";

import { porOciosidade } from "@/app/api/cron/expediente/route";
import { agenteFake, supabaseFake } from "./apoio";

/**
 * O tick escolhe UM agente por vez e para no primeiro que pegar tarefa. Com a
 * lista em ordem fixa, quem está no topo e tem fila monopoliza a empresa
 * inteira — foi o que aconteceu de verdade: o Gestor com seis tarefas, o Dev e
 * a Revisora sem trabalhar nenhuma vez.
 */
describe("quem trabalha primeiro", () => {
  const gestor = agenteFake({ id: "g", nome: "Gestor", papel: "gestor" });
  const dev = agenteFake({ id: "d", nome: "Dev", papel: "dev" });
  const revisor = agenteFake({ id: "r", nome: "Revisor", papel: "revisor" });

  it("põe na frente quem está parado há mais tempo", async () => {
    const supabase = supabaseFake({
      execucoes: [
        { agente_id: "g", criado_em: "2026-09-06T12:00:00Z" },
        { agente_id: "d", criado_em: "2026-09-06T08:00:00Z" },
        { agente_id: "r", criado_em: "2026-09-06T10:00:00Z" },
      ],
    });

    const ordem = await porOciosidade(supabase, [gestor, dev, revisor]);

    expect(ordem.map((a) => a.nome)).toEqual(["Dev", "Revisor", "Gestor"]);
  });

  it("quem nunca trabalhou vem antes de quem já trabalhou", async () => {
    const supabase = supabaseFake({
      execucoes: [{ agente_id: "g", criado_em: "2026-09-06T12:00:00Z" }],
    });

    const ordem = await porOciosidade(supabase, [gestor, dev]);

    expect(ordem[0].nome).toBe("Dev");
  });

  it("sem histórico nenhum, mantém o time inteiro", async () => {
    const ordem = await porOciosidade(supabaseFake({ execucoes: [] }), [gestor, dev, revisor]);
    expect(ordem).toHaveLength(3);
  });
});
