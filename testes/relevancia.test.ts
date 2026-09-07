import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/lib/agentes/ferramentas";
import { ferramentasRelevantes } from "@/lib/agentes/relevancia";
import { tarefaFake } from "./apoio";

/**
 * O Gestor tem quinze ferramentas e mandava todas em cada requisição — ~2000
 * tokens de schema, pagos a cada turno, mesmo numa tarefa de pesquisa que não
 * usa nenhuma delas. Era o maior peso fixo do prompt e o que fazia a chamada
 * estourar o teto do provedor antes de qualquer raciocínio.
 */
describe("ferramentas relevantes por tarefa", () => {
  const nomes = (fs: { nome: string }[]) => fs.map((f) => f.nome);

  it("numa tarefa de código, manda as de repositório e não as de contratação", () => {
    const r = ferramentasRelevantes(
      CATALOGO,
      tarefaFake({
        titulo: "Mostrar no painel quando foi o último tick",
        descricao: "Altere app/page.tsx para exibir a data do log mais recente.",
      }),
    );

    expect(nomes(r)).toContain("ler_arquivo");
    expect(nomes(r)).toContain("abrir_pr");
    expect(nomes(r)).not.toContain("contratar_agente");
    expect(nomes(r)).not.toContain("publicar_pagina");
  });

  it("numa tarefa de pesquisa, manda as de web e não as de código", () => {
    const r = ferramentasRelevantes(
      CATALOGO,
      tarefaFake({
        titulo: "Pesquisar e escolher o nicho da empresa",
        descricao: "Investigue mercados candidatos e registre a escolha com fontes.",
      }),
    );

    expect(nomes(r)).toContain("buscar_web");
    expect(nomes(r)).toContain("anotar_memoria");
    expect(nomes(r)).not.toContain("abrir_pr");
  });

  it("sempre mantém o básico: pedir ajuda, delegar e carregar skill", () => {
    const r = ferramentasRelevantes(
      CATALOGO,
      tarefaFake({ titulo: "Pesquisar concorrentes", descricao: "" }),
    );

    for (const essencial of ["pedir_providencia", "criar_tarefa", "carregar_skill"]) {
      expect(nomes(r)).toContain(essencial);
    }
  });

  it("corta o suficiente para valer a pena", () => {
    const r = ferramentasRelevantes(
      CATALOGO,
      tarefaFake({ titulo: "Corrigir bug no componente", descricao: "" }),
    );

    expect(r.length).toBeLessThan(CATALOGO.length);
  });

  it("tarefa que não se encaixa em nada recebe o kit inteiro", () => {
    // Errar para menos deixaria o agente sem meio de trabalhar; errar para mais
    // só custa tokens.
    const r = ferramentasRelevantes(
      CATALOGO,
      tarefaFake({ titulo: "Zzz qqq", descricao: "vvv" }),
    );

    expect(r.length).toBe(CATALOGO.length);
  });

  it("sem tarefa, não filtra nada", () => {
    expect(ferramentasRelevantes(CATALOGO, null).length).toBe(CATALOGO.length);
  });
});
