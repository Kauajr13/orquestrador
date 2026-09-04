import {
  abrirPR as abrirPRnoGitHub,
  commitar,
  criarBranch,
  tocaEspinhaDorsal,
  tocaMigration,
} from "@/lib/github";
import type { Ferramenta } from "./tipos";

/**
 * Como a empresa muda a si mesma.
 *
 * Nada entra direto na main: sempre PR, sempre revisado, sempre com CI. O Dev
 * escreve, o Revisor opina, o CI decide se compila, e só então o merge. É o
 * ciclo que permite autonomia sem que um erro derrube a empresa inteira.
 */
export const abrirPR: Ferramenta = {
  nome: "abrir_pr",
  descricao:
    "Abre um Pull Request com os arquivos que você escreveu. Mande o conteúdo COMPLETO de cada arquivo, não um diff.",
  parametros: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título do PR, uma linha no imperativo" },
      descricao: {
        type: "string",
        description: "O que muda e por quê. O Revisor lê isto antes do código.",
      },
      arquivos: {
        type: "array",
        description: "Os arquivos, com conteúdo integral",
        items: {
          type: "object",
          properties: {
            caminho: { type: "string", description: "Caminho a partir da raiz do repo" },
            conteudo: { type: "string", description: "O arquivo inteiro, do começo ao fim" },
          },
          required: ["caminho", "conteudo"],
        },
      },
    },
    required: ["titulo", "descricao", "arquivos"],
  },

  async executar(args, ctx) {
    const titulo = String(args.titulo ?? "").trim();
    const descricao = String(args.descricao ?? "").trim();

    if (!titulo || !descricao) throw new Error("título e descrição são obrigatórios");

    const arquivos = (Array.isArray(args.arquivos) ? args.arquivos : [])
      .map((a) => {
        const item = a as { caminho?: unknown; conteudo?: unknown };
        return {
          caminho: String(item.caminho ?? "").trim().replace(/^\/+/, ""),
          conteudo: String(item.conteudo ?? ""),
        };
      })
      .filter((a) => a.caminho && a.conteudo);

    if (!arquivos.length) throw new Error("nenhum arquivo com caminho e conteúdo válidos");

    for (const a of arquivos) {
      if (a.caminho.includes("..")) throw new Error(`caminho suspeito: ${a.caminho}`);
    }

    if (!ctx.tarefa) throw new Error("abrir PR exige uma tarefa em andamento");

    const branch = `agente/${ctx.agente.nome.toLowerCase()}-${ctx.tarefa.id.slice(0, 8)}`;
    const caminhos = arquivos.map((a) => a.caminho);

    // 422 aqui é "branch já existe": um tick anterior morreu depois de criar o
    // branch e antes de abrir o PR. Sobrescrever seria apagar trabalho que pode
    // já estar em revisão, então paramos e deixamos um humano olhar.
    const shaBase = await criarBranch(branch).catch((e: Error) => {
      if (e.message.includes("422")) {
        throw new Error(
          `o branch ${branch} sobrou de uma tentativa anterior. Não vou sobrescrever: avise seu superior.`,
        );
      }
      throw e;
    });

    await commitar(branch, shaBase, arquivos, `${titulo}\n\n${descricao}`);

    const migration = tocaMigration(caminhos);
    const sensiveis = tocaEspinhaDorsal(caminhos);

    const corpo = [
      descricao,
      "",
      `Aberto por **${ctx.agente.nome}** (${ctx.agente.papel}) para a tarefa _${ctx.tarefa.titulo}_.`,
      migration
        ? "\n> **Toca `supabase/`.** Este PR precisa de aprovação humana antes do merge — é o único erro sem volta do sistema."
        : "",
      sensiveis.length
        ? `\n> Mexe na espinha dorsal: ${sensiveis.join(", ")}. O merge segue automático; o aviso é para o Kauã saber.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const pr = await abrirPRnoGitHub(branch, titulo, corpo);

    await ctx.supabase
      .from("tarefas")
      .update({
        status: "em_revisao",
        pr_numero: pr.numero,
        pr_url: pr.url,
        branch,
      })
      .eq("id", ctx.tarefa.id);

    await ctx.registrar("sucesso", `${ctx.agente.nome} abriu o PR #${pr.numero}: ${titulo}`);

    if (migration) {
      await ctx.supabase.from("notificacoes").insert({
        texto: `PR #${pr.numero} mexe no banco (${caminhos.filter((c) => c.startsWith("supabase/")).join(", ")}) e está esperando seu OK.\n\n${titulo}\n${pr.url}`,
        urgencia: "normal",
        tarefa_id: ctx.tarefa.id,
      });
    }

    return `PR #${pr.numero} aberto: ${pr.url}. ${migration ? "Como toca o banco, fica parado até o Kauã aprovar." : "Segue para revisão."} Sua parte nesta tarefa acabou.`;
  },
};
