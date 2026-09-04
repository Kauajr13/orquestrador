import { checarOriginalidade } from "@/lib/conformidade/originalidade";
import type { Ferramenta } from "./tipos";

/**
 * O que a empresa mostra ao mundo.
 *
 * Publicar não passa por PR: é uma linha no banco, sem build e sem deploy.
 * Isso é de propósito — marketing não pode ficar refém do ciclo de código, e
 * conteúdo não pode derrubar a aplicação. Em compensação, as travas aqui são
 * mais rígidas, porque o que sai daqui sai sob o domínio de uma pessoa real.
 */

/** Afirmação com número, dinheiro ou porcentagem precisa dizer de onde veio. */
const CHEIRO_DE_FATO = /(\d+\s*%|R\$\s*\d|US\$\s*\d|\b(segundo|conforme|de acordo com)\b)/i;

export const publicarPagina: Ferramenta = {
  nome: "publicar_pagina",
  descricao:
    "Publica uma página no site da empresa. Antes de usar, carregue a skill 'humanizer' e escreva o texto com ela.",
  parametros: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Endereço da página, em minúsculas com hífens, ex.: 'como-escolher-x'",
      },
      titulo: { type: "string" },
      resumo: { type: "string", description: "Uma ou duas frases; aparece na listagem e no SEO" },
      conteudo: { type: "string", description: "O texto completo, em Markdown" },
      fontes: {
        type: "array",
        items: { type: "string" },
        description: "URLs que sustentam as afirmações factuais do texto",
      },
      publicar_agora: {
        type: "boolean",
        description: "true põe no ar; false salva como rascunho",
      },
    },
    required: ["slug", "titulo", "resumo", "conteudo"],
  },

  async executar(args, ctx) {
    const slug = String(args.slug ?? "").trim().toLowerCase();
    const titulo = String(args.titulo ?? "").trim();
    const resumo = String(args.resumo ?? "").trim();
    const conteudo = String(args.conteudo ?? "").trim();
    const fontes = Array.isArray(args.fontes) ? args.fontes.map(String).filter(Boolean) : [];

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("slug só aceita minúsculas, números e hífen");
    }
    if (!titulo || !resumo || !conteudo) {
      throw new Error("título, resumo e conteúdo são obrigatórios");
    }

    // Regra 5 da constituição. A trava não pergunta se o agente usou o
    // humanizer — ela olha o registro do que ele carregou de fato.
    if (!ctx.skillsCarregadas.has("humanizer")) {
      throw new Error(
        "carregue a skill 'humanizer' e reescreva o texto com ela antes de publicar. Nada com cara de IA sai sob o domínio do Kauã.",
      );
    }

    if (CHEIRO_DE_FATO.test(conteudo) && !fontes.length) {
      throw new Error(
        "o texto afirma número, valor ou atribui algo a alguém, e não tem fonte. Cite a origem ou reescreva sem a afirmação.",
      );
    }

    const checagem = checarOriginalidade(conteudo, ctx.fontesLidas);
    if (!checagem.original) {
      throw new Error(
        `este trecho é cópia de ${checagem.origem}: "${checagem.trecho}". Reescreva com suas palavras, ou marque como citação curta com atribuição.`,
      );
    }

    const publicada = args.publicar_agora !== false;

    const { error } = await ctx.supabase.from("paginas").upsert(
      {
        slug,
        titulo,
        resumo,
        conteudo,
        fontes,
        publicada,
        agente_id: ctx.agente.id,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "slug" },
    );

    if (error) throw new Error(error.message);

    await ctx.registrar(
      "sucesso",
      `${ctx.agente.nome} ${publicada ? "publicou" : "salvou como rascunho"} /${slug}`,
    );

    return publicada
      ? `No ar em /${slug}.`
      : `Rascunho salvo em /${slug}; publique quando estiver pronto.`;
  },
};

export const escreverDiario: Ferramenta = {
  nome: "escrever_diario",
  descricao:
    "Escreve sua linha do dia no diário da empresa, em primeira pessoa. Uma por dia; escrever de novo substitui a anterior.",
  parametros: {
    type: "object",
    properties: {
      texto: {
        type: "string",
        description: "Uma ou duas frases sobre o que você fez hoje e o que achou disso",
      },
    },
    required: ["texto"],
  },

  async executar(args, ctx) {
    const texto = String(args.texto ?? "").trim();
    if (!texto) throw new Error("texto vazio");
    if (texto.length > 500) throw new Error("no máximo 500 caracteres — é uma linha, não um relatório");

    const { error } = await ctx.supabase.from("diario").upsert(
      {
        agente_id: ctx.agente.id,
        dia: new Date().toISOString().slice(0, 10),
        texto,
      },
      { onConflict: "agente_id,dia" },
    );

    if (error) throw new Error(error.message);
    return "Anotado no diário.";
  },
};

export const registrarMeta: Ferramenta = {
  nome: "registrar_meta",
  descricao:
    "Registra progresso na meta ativa, com a evidência concreta. Sem evidência não conta como progresso.",
  parametros: {
    type: "object",
    properties: {
      evidencia: {
        type: "string",
        description:
          "O fato observável que mostra o avanço: um número, um link, uma decisão tomada com base em dado",
      },
      atingida: {
        type: "boolean",
        description: "true só quando o alvo da meta foi de fato alcançado",
      },
    },
    required: ["evidencia"],
  },

  async executar(args, ctx) {
    const evidencia = String(args.evidencia ?? "").trim();
    if (evidencia.length < 20) {
      throw new Error(
        "evidência curta demais. Descreva o fato observável — 'pesquisei bastante' não é evidência; '18 dos 20 anúncios analisados citam X' é.",
      );
    }

    const { data: meta } = await ctx.supabase
      .from("metas")
      .select("*")
      .eq("ativa", true)
      .maybeSingle();

    if (!meta) throw new Error("não há meta ativa");

    const atingida = args.atingida === true;

    const { error } = await ctx.supabase
      .from("metas")
      .update({
        evidencia,
        atingida,
        atingida_em: atingida ? new Date().toISOString() : null,
      })
      .eq("id", meta.id);

    if (error) throw new Error(error.message);

    await ctx.registrar(
      atingida ? "sucesso" : "info",
      `${ctx.agente.nome} registrou progresso em "${meta.titulo}"`,
    );

    return atingida
      ? `Meta "${meta.titulo}" marcada como atingida. O Gestor precisa ativar a próxima.`
      : "Progresso registrado.";
  },
};
