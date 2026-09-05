import { lerSkill } from "../skills";
import type { Ferramenta } from "./tipos";

export const carregarSkill: Ferramenta = {
  nome: "carregar_skill",
  descricao:
    "Lê uma skill por inteiro. O prompt só traz o índice; carregue a skill antes de executar o trabalho que ela ensina.",
  parametros: {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome da skill, como aparece no índice" },
    },
    required: ["nome"],
  },

  async executar(args, ctx) {
    const nome = String(args.nome ?? "").trim().toLowerCase();
    if (!nome) throw new Error("nome vazio");

    if (!ctx.agente.skills.includes(nome)) {
      throw new Error(
        `a skill "${nome}" não está no seu kit. Seu kit: ${ctx.agente.skills.join(", ") || "vazio"}. Peça ao seu superior se precisar dela.`,
      );
    }

    const skill = await lerSkill(nome);
    ctx.skillsCarregadas.add(nome);

    await ctx.registrar("info", `carreguei a skill ${nome}`);
    return skill.conteudo;
  },
};
