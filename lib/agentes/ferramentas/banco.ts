import { mascararProfundo } from "@/lib/conformidade/pii";
import type { Ferramenta } from "./tipos";

/**
 * Como a empresa se enxerga por dentro.
 *
 * Não existe SQL cru aqui de propósito: um agente com poder de escrever SQL
 * livre pode apagar o banco por engano, e o plano gratuito do Supabase não tem
 * recovery. Leitura estruturada resolve tudo que um funcionário precisa saber
 * e não abre essa porta.
 */

// `consentimentos` fica fora da lista, e isso é deliberado: é dado pessoal puro,
// não ajuda em nenhuma decisão de negócio, e a LGPD pede minimização. Quem
// precisa saber "quantos leads temos" usa a contagem, não a lista de e-mails.
const TABELAS_LEGIVEIS = [
  "agentes",
  "times",
  "tarefas",
  "logs",
  "memoria",
  "metas",
  "retrospectivas",
  "paginas",
  "diario",
  "atas",
  "caixa",
  "config",
] as const;

export const consultarBanco: Ferramenta = {
  nome: "consultar_banco",
  descricao: `Lê dados da própria empresa. Tabelas: ${TABELAS_LEGIVEIS.join(", ")}. Use para saber quem trabalha aqui, o que está na fila, o que já foi aprendido e como está o caixa.`,
  parametros: {
    type: "object",
    properties: {
      tabela: { type: "string", enum: [...TABELAS_LEGIVEIS] },
      filtro_coluna: { type: "string", description: "Coluna para filtrar (opcional)" },
      filtro_valor: { type: "string", description: "Valor exato a comparar (opcional)" },
      ordenar_por: { type: "string", description: "Coluna de ordenação (opcional)" },
      limite: { type: "number", description: "Quantas linhas (1 a 50, padrão 20)" },
    },
    required: ["tabela"],
  },

  async executar(args, ctx) {
    const tabela = String(args.tabela ?? "");
    if (!TABELAS_LEGIVEIS.includes(tabela as (typeof TABELAS_LEGIVEIS)[number])) {
      throw new Error(
        `"${tabela}" não é legível. Disponíveis: ${TABELAS_LEGIVEIS.join(", ")}. A tabela de consentimentos é dado pessoal e não é consultável — se precisar do número de inscritos, peça a contagem ao seu superior.`,
      );
    }

    const limite = Math.min(Math.max(Number(args.limite) || 20, 1), 50);
    let consulta = ctx.supabase.from(tabela).select("*").limit(limite);

    if (args.filtro_coluna && args.filtro_valor !== undefined) {
      consulta = consulta.eq(String(args.filtro_coluna), String(args.filtro_valor));
    }
    if (args.ordenar_por) {
      consulta = consulta.order(String(args.ordenar_por), { ascending: false });
    }

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    if (!data?.length) return "Nenhuma linha.";

    // Regra 4: nada de dado pessoal indo para um modelo hospedado fora do país.
    // Mascarar aqui, e não na query, é mais seguro do que confiar que quem
    // escreveu a consulta lembrou de excluir a coluna certa.
    return JSON.stringify(mascararProfundo(data), null, 1);
  },
};

export const anotarMemoria: Ferramenta = {
  nome: "anotar_memoria",
  descricao:
    "Guarda algo que a empresa aprendeu, para todos os colegas e para o futuro. Exige fonte: conclusão sem origem é chute.",
  parametros: {
    type: "object",
    properties: {
      chave: {
        type: "string",
        description: "Identificador curto e estável, ex.: 'nicho-candidato-2'",
      },
      conteudo: { type: "string", description: "O que foi aprendido, por extenso" },
      fontes: {
        type: "array",
        items: { type: "string" },
        description: "URLs ou referências que sustentam isso",
      },
    },
    required: ["chave", "conteudo", "fontes"],
  },

  async executar(args, ctx) {
    const chave = String(args.chave ?? "").trim();
    const conteudo = String(args.conteudo ?? "").trim();
    const fontes = Array.isArray(args.fontes) ? args.fontes.map(String).filter(Boolean) : [];

    if (!chave || !conteudo) throw new Error("chave e conteúdo são obrigatórios");
    if (!fontes.length) {
      throw new Error(
        "sem fonte não entra na memória. Se isto é raciocínio seu e não leitura, diga de onde partiu — 'análise própria a partir de X'.",
      );
    }

    const { error } = await ctx.supabase.from("memoria").upsert(
      {
        chave,
        conteudo,
        fontes,
        agente_id: ctx.agente.id,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );

    if (error) throw new Error(error.message);

    await ctx.registrar("sucesso", `${ctx.agente.nome} anotou "${chave}" na memória`);
    return `Anotado sob a chave "${chave}", com ${fontes.length} fonte(s).`;
  },
};
