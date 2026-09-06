import { lerArquivo, listarPasta } from "@/lib/github";
import type { Ferramenta } from "./tipos";

/**
 * Os olhos do Dev dentro do próprio repositório.
 *
 * `abrir_pr` pede o conteúdo integral de cada arquivo, então sem estas duas
 * ferramentas modificar qualquer coisa significaria reescrevê-la de memória —
 * apagando o que existe. Ler antes de escrever não é boa prática aqui, é
 * requisito.
 *
 * Alcançam apenas o repositório da empresa, pelo mesmo token de escopo único
 * que abre os PRs (regra 7 da constituição).
 */

export const lerArquivoDoRepo: Ferramenta = {
  nome: "ler_arquivo",
  descricao:
    "Lê um arquivo do repositório da empresa. Use SEMPRE antes de alterar um arquivo existente — abrir_pr exige o conteúdo completo, e sem ler você apagaria o que está lá.",
  parametros: {
    type: "object",
    properties: {
      caminho: {
        type: "string",
        description: "Caminho a partir da raiz, ex.: 'app/page.tsx'",
      },
    },
    required: ["caminho"],
  },

  // Arquivo pela metade é pior que arquivo nenhum: o agente lê, não acha o que
  // procura, e lê de novo. Aqui o teto acompanha o tamanho real dos arquivos
  // do projeto.
  tetoResposta: 9_000,

  async executar(args, ctx) {
    const caminho = String(args.caminho ?? "").trim().replace(/^\/+/, "");
    if (!caminho) throw new Error("caminho vazio");
    if (caminho.includes("..")) throw new Error(`caminho suspeito: ${caminho}`);

    const conteudo = await lerArquivo(caminho);
    await ctx.registrar("info", `li ${caminho}`);

    // Arquivo grande estoura o teto de tokens por minuto do provedor e trava o
    // agente. Melhor devolver o começo e avisar do corte do que derrubar o
    // raciocínio inteiro.
    const teto = 8_000;
    if (conteudo.length > teto) {
      return `${caminho} (${conteudo.length} caracteres, mostrando os primeiros ${teto}):\n\n${conteudo.slice(0, teto)}\n\n[…arquivo cortado. Se precisar do resto, diga qual parte.]`;
    }

    return `${caminho}:\n\n${conteudo}`;
  },
};

export const listarPastaDoRepo: Ferramenta = {
  nome: "listar_arquivos",
  descricao:
    "Lista o que existe numa pasta do repositório. Use para se orientar antes de pedir um arquivo.",
  parametros: {
    type: "object",
    properties: {
      caminho: {
        type: "string",
        description: "Pasta a partir da raiz, ex.: 'app' ou 'lib/agentes'. Vazio = raiz.",
      },
    },
  },

  async executar(args, ctx) {
    const caminho = String(args.caminho ?? "").trim().replace(/^\/+|\/+$/g, "");
    if (caminho.includes("..")) throw new Error(`caminho suspeito: ${caminho}`);

    const itens = await listarPasta(caminho);
    await ctx.registrar("info", `listei ${caminho || "a raiz"}`);

    return itens
      .map((i) => (i.tipo === "dir" ? `${i.nome}/` : `${i.nome} (${i.tamanho} bytes)`))
      .join("\n");
  },
};
