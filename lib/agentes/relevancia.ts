import type { Ferramenta } from "./ferramentas/tipos";
import type { Tarefa } from "@/lib/tipos";

/**
 * Quais ferramentas vão para o modelo nesta tarefa.
 *
 * O agente possui todas as do seu kit — isso não muda, e é o que sustenta a
 * regra 2 (ninguém concede o que não tem). O que muda é quantas são
 * *declaradas* na requisição.
 *
 * A diferença é cara: o Gestor carrega quinze ferramentas, cerca de 2000 tokens
 * de schema, em toda chamada — mesmo quando a tarefa é só pesquisar um mercado.
 * Como o prompt inteiro é reenviado a cada turno, esse peso é pago dezenas de
 * vezes por tarefa, e é o que faz a requisição estourar o teto do provedor
 * antes de o agente pensar qualquer coisa.
 *
 * Se ele pedir uma ferramenta que ficou de fora, o runner já sabe responder
 * "essa não está no seu kit, as suas são…" e o passo seguinte vem com o
 * conjunto ampliado. O erro é barato; o peso constante não era.
 */

/** Serve para qualquer trabalho: orientar-se, pedir ajuda, delegar, registrar. */
const SEMPRE = [
  "carregar_skill",
  "consultar_banco",
  "criar_tarefa",
  "escrever_diario",
  "pedir_providencia",
];

const POR_ASSUNTO: Array<{ termos: RegExp; ferramentas: string[] }> = [
  {
    termos:
      /\b(c[óo]digo|arquivo|componente|p[áa]gina|painel|rota|endpoint|script|teste|bug|corrig|implement|refator|build|deploy|migration|schema|pr\b)/i,
    ferramentas: ["ler_arquivo", "listar_arquivos", "abrir_pr"],
  },
  {
    termos:
      /\b(pesquis|mercado|nicho|concorrent|buscar|investig|avali|analis|estud|fonte|tend[êe]ncia|pre[çc]o)/i,
    ferramentas: ["buscar_web", "ler_pagina", "anotar_memoria"],
  },
  {
    termos: /\b(contrat|funcion[áa]rio|agente|time|promov|equipe|l[íi]der|rh)\b/i,
    ferramentas: ["contratar_agente", "promover_agente"],
  },
  {
    termos: /\b(public|site|conte[úu]do|landing|artigo|seo|texto|p[áa]gina p[úu]blica)/i,
    ferramentas: ["publicar_pagina", "anotar_memoria"],
  },
  {
    termos: /\b(meta|progresso|evid[êe]ncia|retrospectiva|objetivo)\b/i,
    ferramentas: ["registrar_meta", "anotar_memoria"],
  },
];

/**
 * Quando nada casa, é sinal de tarefa que não sabemos classificar — aí manda
 * tudo, porque errar para menos deixaria o agente sem meio de trabalhar.
 */
export function ferramentasRelevantes(
  doKit: Ferramenta[],
  tarefa: Tarefa | null,
): Ferramenta[] {
  if (!tarefa) return doKit;

  const texto = `${tarefa.titulo} ${tarefa.descricao}`;
  const escolhidas = new Set(SEMPRE);
  let casou = false;

  for (const { termos, ferramentas } of POR_ASSUNTO) {
    if (termos.test(texto)) {
      casou = true;
      for (const f of ferramentas) escolhidas.add(f);
    }
  }

  if (!casou) return doKit;

  const filtradas = doKit.filter((f) => escolhidas.has(f.nome));

  // Rede de segurança: se o filtro deixou quase nada, algo está errado na
  // classificação e é melhor mandar o kit inteiro do que um agente manco.
  return filtradas.length >= 3 ? filtradas : doKit;
}
