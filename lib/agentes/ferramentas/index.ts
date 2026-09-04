import { anotarMemoria, consultarBanco } from "./banco";
import { abrirPR } from "./codigo";
import { pedirProvidencia } from "./humano";
import { contratarAgente, criarTarefa, promoverAgente } from "./organizacao";
import { escreverDiario, publicarPagina, registrarMeta } from "./publicacao";
import { carregarSkill } from "./skills";
import type { Ferramenta } from "./tipos";
import { buscarWeb, lerPagina } from "./web";

/**
 * Tudo que existe na empresa. Quem tem o quê é decidido por agente, em
 * `agentes.ferramentas` — e ninguém concede o que não tem (regra 2).
 *
 * Uma ferramenta nova aqui não dá poder a ninguém sozinha: precisa ser
 * adicionada ao kit de alguém. Isso é de propósito, para que ampliar a
 * capacidade da empresa seja uma decisão, e não um efeito colateral de merge.
 */
export const CATALOGO: Ferramenta[] = [
  buscarWeb,
  lerPagina,
  consultarBanco,
  anotarMemoria,
  criarTarefa,
  contratarAgente,
  promoverAgente,
  carregarSkill,
  publicarPagina,
  escreverDiario,
  registrarMeta,
  abrirPR,
  pedirProvidencia,
];

export function acharFerramenta(nome: string): Ferramenta | undefined {
  return CATALOGO.find((f) => f.nome === nome);
}

export const NOMES_DE_FERRAMENTAS = CATALOGO.map((f) => f.nome);

export type { Contexto, Ferramenta } from "./tipos";
