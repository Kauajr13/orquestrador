import type { Agente } from "@/lib/tipos";
import type { Contexto, Ferramenta } from "./tipos";

/**
 * Como a empresa cresce. O Gestor percebe que falta gente e contrata; um time
 * que ficou grande ganha líder.
 *
 * A trava que sustenta isso é a regra 2 da constituição: ninguém concede o que
 * não tem. Sem ela, "contratar sozinho" seria o caminho mais curto para um
 * agente comum fabricar um colega todo-poderoso e usá-lo como procurador.
 */

export const criarTarefa: Ferramenta = {
  nome: "criar_tarefa",
  descricao:
    "Cria uma tarefa na fila. Pode ser para você mesmo, para um subordinado, ou sem dono (aí quem estiver livre pega).",
  parametros: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Uma linha dizendo o que fazer" },
      descricao: {
        type: "string",
        description: "O contexto completo: o porquê, o que já se sabe, como saber que terminou",
      },
      para: {
        type: "string",
        description: "Nome do agente que deve executar. Omita para deixar na fila geral.",
      },
      prioridade: { type: "number", description: "1 (baixa) a 10 (alta). Padrão 5." },
    },
    required: ["titulo", "descricao"],
  },

  async executar(args, ctx) {
    const titulo = String(args.titulo ?? "").trim();
    const descricao = String(args.descricao ?? "").trim();
    if (!titulo) throw new Error("título vazio");

    let destinatario: Agente | null = null;
    if (args.para) {
      destinatario = await acharAgente(ctx, String(args.para));
      if (!podeMandarEm(ctx.agente, destinatario)) {
        throw new Error(
          `${destinatario.nome} não é seu subordinado. Você só atribui tarefa a si mesmo ou a quem se reporta a você — para pedir algo a outro time, fale com seu superior.`,
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("tarefas")
      .insert({
        titulo,
        descricao,
        agente_id: destinatario?.id ?? null,
        atribuida_por: ctx.agente.id,
        prioridade: Math.min(Math.max(Number(args.prioridade) || 5, 1), 10),
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await ctx.registrar(
      "info",
      `${ctx.agente.nome} criou a tarefa "${titulo}"${destinatario ? ` para ${destinatario.nome}` : ""}`,
    );

    return `Tarefa criada (id ${data.id})${destinatario ? `, atribuída a ${destinatario.nome}` : ", na fila geral"}.`;
  },
};

export const contratarAgente: Ferramenta = {
  nome: "contratar_agente",
  descricao:
    "Contrata um novo funcionário. Escolha o papel, escreva o prompt dele e dê o kit de ferramentas e skills. Você só pode conceder o que você mesmo tem.",
  parametros: {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome próprio, curto. Precisa ser único." },
      papel: {
        type: "string",
        description: "Função: pesquisador, marketing, design, seguranca, rh, conteudo, vendas…",
      },
      prompt: {
        type: "string",
        description:
          "Quem essa pessoa é e como ela trabalha. Escreva em segunda pessoa, como se falasse com ela.",
      },
      ferramentas: {
        type: "array",
        items: { type: "string" },
        description: "Nomes das ferramentas do kit dela",
      },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "Nomes das skills do kit dela",
      },
      motivo: {
        type: "string",
        description: "Por que a empresa precisa dessa contratação agora",
      },
    },
    required: ["nome", "papel", "prompt", "motivo"],
  },

  async executar(args, ctx) {
    const nome = String(args.nome ?? "").trim();
    const papel = String(args.papel ?? "").trim().toLowerCase();
    const prompt = String(args.prompt ?? "").trim();
    const motivo = String(args.motivo ?? "").trim();

    if (!nome || !papel || !prompt) throw new Error("nome, papel e prompt são obrigatórios");
    if (!motivo) throw new Error("diga por que a empresa precisa dessa contratação");

    const ferramentas = listaDeTexto(args.ferramentas);
    const skills = listaDeTexto(args.skills);

    // Regra 2 da constituição, e o motivo de esta ferramenta existir com trava.
    const ferramentasDemais = ferramentas.filter((f) => !ctx.agente.ferramentas.includes(f));
    if (ferramentasDemais.length) {
      throw new Error(
        `você não pode dar o que não tem: ${ferramentasDemais.join(", ")}. Seu kit é ${ctx.agente.ferramentas.join(", ") || "vazio"}.`,
      );
    }

    const skillsDemais = skills.filter((s) => !ctx.agente.skills.includes(s));
    if (skillsDemais.length) {
      throw new Error(
        `você não pode dar as skills que não tem: ${skillsDemais.join(", ")}.`,
      );
    }

    const { data: jaExiste } = await ctx.supabase
      .from("agentes")
      .select("id")
      .ilike("nome", nome)
      .maybeSingle();
    if (jaExiste) throw new Error(`já existe alguém chamado ${nome}`);

    const { data, error } = await ctx.supabase
      .from("agentes")
      .insert({
        nome,
        papel,
        prompt,
        ferramentas,
        skills,
        superior_id: ctx.agente.id,
        time_id: ctx.agente.time_id,
        contratado_por: ctx.agente.id,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await ctx.supabase.from("atas").insert({
      agente_id: ctx.agente.id,
      decisao: `Contratou ${nome} como ${papel}`,
      justificativa: motivo,
    });

    await ctx.registrar("sucesso", `${ctx.agente.nome} contratou ${nome} (${papel})`);

    // O Kauã fica sabendo, mas não precisa aprovar — ele escolheu que a empresa
    // contrata sozinha. Isto é aviso, não pedido.
    await ctx.supabase.from("notificacoes").insert({
      texto: `Nova contratação: ${nome} (${papel}). Motivo: ${motivo}`,
      urgencia: "normal",
    });

    return `${nome} foi contratado como ${papel} (id ${data.id}), reportando a você, com ${ferramentas.length} ferramenta(s) e ${skills.length} skill(s).`;
  },
};

export const promoverAgente: Ferramenta = {
  nome: "promover_agente",
  descricao:
    "Cria um time e nomeia alguém como líder dele. Use quando um grupo ficou grande demais para reportar tudo a você.",
  parametros: {
    type: "object",
    properties: {
      agente: { type: "string", description: "Nome de quem vai liderar" },
      time: { type: "string", description: "Nome do time" },
      motivo: { type: "string", description: "Por que essa promoção agora" },
    },
    required: ["agente", "time", "motivo"],
  },

  async executar(args, ctx) {
    const alvo = await acharAgente(ctx, String(args.agente ?? ""));
    const nomeTime = String(args.time ?? "").trim();
    const motivo = String(args.motivo ?? "").trim();
    if (!nomeTime) throw new Error("nome do time vazio");

    if (!podeMandarEm(ctx.agente, alvo)) {
      throw new Error(`${alvo.nome} não se reporta a você; você não pode promovê-lo.`);
    }

    const { data: time, error } = await ctx.supabase
      .from("times")
      .upsert({ nome: nomeTime, lider_id: alvo.id }, { onConflict: "nome" })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await ctx.supabase.from("agentes").update({ time_id: time.id }).eq("id", alvo.id);

    await ctx.supabase.from("atas").insert({
      agente_id: ctx.agente.id,
      decisao: `Promoveu ${alvo.nome} a líder do time ${nomeTime}`,
      justificativa: motivo,
    });

    await ctx.registrar("sucesso", `${alvo.nome} agora lidera o time ${nomeTime}`);

    return `${alvo.nome} é o líder do time ${nomeTime}.`;
  },
};

// ------------------------------------------------------------------ apoio

async function acharAgente(ctx: Contexto, nome: string): Promise<Agente> {
  const limpo = nome.trim();
  if (!limpo) throw new Error("nome de agente vazio");

  const { data } = await ctx.supabase
    .from("agentes")
    .select("*")
    .ilike("nome", limpo)
    .maybeSingle();

  if (!data) throw new Error(`não existe ninguém chamado ${limpo}`);
  return data as Agente;
}

/** Manda em si mesmo e em quem se reporta diretamente a você. */
function podeMandarEm(quem: Agente, alvo: Agente): boolean {
  return alvo.id === quem.id || alvo.superior_id === quem.id;
}

function listaDeTexto(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((v) => String(v).trim()).filter(Boolean);
}
