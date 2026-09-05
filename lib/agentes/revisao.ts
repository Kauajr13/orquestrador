import type { SupabaseClient } from "@supabase/supabase-js";
import { conversar } from "@/lib/ai";
import {
  arquivosDoPR,
  comentarNoPR,
  diffDoPR,
  estadoDoCI,
  mergear,
  previewResponde,
  tocaEspinhaDorsal,
  tocaMigration,
  urlDePreview,
  verPR,
} from "@/lib/github";
import { registrarLog } from "@/lib/log";
import type { Agente, Tarefa } from "@/lib/tipos";
import { lerSkill } from "./skills";

/**
 * O Revisor.
 *
 * O Kauã escolheu merge automático: aprovou, entra. Isso só é aceitável porque
 * a aprovação passa por três filtros independentes antes do parecer do modelo —
 * o CI (compila e os testes da constituição passam?), o preview (a página
 * carrega mesmo?) e a trava de migration (mexeu no banco? então espera humano).
 *
 * O parecer do modelo é o último, e é o menos confiável dos quatro. Por isso os
 * outros três vêm antes: economizam token e não dependem de julgamento.
 */

export type ResultadoDaRevisao =
  | { fim: "aguardando"; motivo: string }
  | { fim: "aprovado"; pr: number }
  | { fim: "mudancas"; parecer: string }
  | { fim: "erro"; motivo: string };

export async function revisar(
  supabase: SupabaseClient,
  revisor: Agente,
  tarefa: Tarefa,
): Promise<ResultadoDaRevisao> {
  if (!tarefa.pr_numero) return { fim: "erro", motivo: "tarefa em revisão sem PR" };

  // Regra 3 da constituição. Uma trava que se auto-aprova não é trava.
  if (tarefa.agente_id === revisor.id) {
    return { fim: "erro", motivo: "não reviso PR que eu mesmo abri" };
  }

  const pr = await verPR(tarefa.pr_numero);

  if (pr.merged) {
    await concluir(supabase, tarefa, "PR já estava mergeado.");
    return { fim: "aprovado", pr: tarefa.pr_numero };
  }
  if (pr.state !== "open") {
    return { fim: "erro", motivo: `o PR #${tarefa.pr_numero} está ${pr.state}` };
  }

  const arquivos = await arquivosDoPR(tarefa.pr_numero);

  // Regra 9: mexeu no banco, espera o Kauã. É o único erro sem volta.
  if (tocaMigration(arquivos)) {
    const { data: aprovacao } = await supabase
      .from("aprovacoes")
      .select("*")
      .eq("pr_numero", tarefa.pr_numero)
      .maybeSingle();

    if (!aprovacao) {
      await supabase
        .from("aprovacoes")
        .insert({ pr_numero: tarefa.pr_numero, aprovado: null });
      return { fim: "aguardando", motivo: "migration esperando aprovação do chefe" };
    }
    if (aprovacao.aprovado === null) {
      return { fim: "aguardando", motivo: "migration esperando aprovação do chefe" };
    }
    if (aprovacao.aprovado === false) {
      return await pedirMudancas(
        supabase,
        revisor,
        tarefa,
        `O chefe recusou a migration: ${aprovacao.motivo ?? "sem motivo declarado"}`,
      );
    }
  }

  // O CI é o filtro que não depende de opinião. Reprovou, não entra — mesmo
  // que o código pareça ótimo.
  const ci = await estadoDoCI(pr.head.sha);
  if (ci === "rodando") {
    return { fim: "aguardando", motivo: "CI ainda rodando" };
  }
  if (ci === "falhou") {
    return await pedirMudancas(
      supabase,
      revisor,
      tarefa,
      "O CI reprovou. Pode ser tipo, teste, build, DDL destrutivo ou segredo no diff — veja os checks do PR e corrija antes de pedir revisão de novo.",
    );
  }

  // Código de modelo compila e quebra em runtime com frequência. Abrir a página
  // é barato e pega isso.
  const preview = await urlDePreview(pr.head.sha);
  let notaDoPreview = "não havia preview";

  if (preview) {
    const resposta = await previewResponde(preview);

    if (resposta.estado === "quebrado") {
      return await pedirMudancas(
        supabase,
        revisor,
        tarefa,
        `O build passou, mas o preview não carrega (${resposta.status ?? "sem resposta"}): ${preview}. Alguma coisa quebra em runtime.`,
      );
    }

    notaDoPreview =
      resposta.estado === "ok"
        ? "carrega"
        : "existe, mas está atrás da proteção da Vercel — não deu para verificar";
  }

  const diff = (await diffDoPR(tarefa.pr_numero)).slice(0, 30_000);
  const sensiveis = tocaEspinhaDorsal(arquivos);

  const skill = await lerSkill("revisao-de-codigo").catch(() => null);

  const prompt = [
    revisor.prompt,
    skill ? `\n# Como revisar\n\n${skill.conteudo}` : "",
    `\n# O que já foi verificado por máquina

- CI: verde (tipos, testes da constituição, build, DDL, segredo)
- Preview: ${notaDoPreview}

Não repita esses testes. Olhe o que só uma leitura pega: a mudança faz o que a
descrição diz? Quebra alguma trava? Introduz erro de lógica? Está no lugar certo?`,
    sensiveis.length
      ? `\n**Atenção:** este PR mexe em ${sensiveis.join(", ")}. Leia com mais cuidado — é a espinha dorsal da empresa.`
      : "",
    `\n# Responda em JSON

{"aprovado": true|false, "parecer": "texto curto e direto"}

Aprove quando a mudança estiver correta e no lugar certo. Peça mudanças quando
houver erro real — não por preferência de estilo. Se pedir mudanças, diga
exatamente o que corrigir.`,
  ]
    .filter(Boolean)
    .join("\n");

  const resposta = await conversar(
    [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `PR #${pr.number}: ${pr.title}\n\n${pr.body ?? ""}\n\nArquivos: ${arquivos.join(", ")}\n\n\`\`\`diff\n${diff}\n\`\`\``,
      },
    ],
    { tipo: "caro", modelo: revisor.modelo, maxTokens: 2000 },
  );

  await registrarExecucao(supabase, revisor, tarefa, resposta);

  const veredito = interpretar(resposta.conteudo ?? "");

  if (!veredito.aprovado) {
    return await pedirMudancas(supabase, revisor, tarefa, veredito.parecer);
  }

  await comentarNoPR(
    tarefa.pr_numero,
    `**${revisor.nome}** aprovou.\n\n${veredito.parecer}`,
  );
  await mergear(tarefa.pr_numero, pr.title);
  await concluir(supabase, tarefa, veredito.parecer);

  await registrarLog(supabase, {
    agente_id: revisor.id,
    tarefa_id: tarefa.id,
    nivel: "sucesso",
    mensagem: `aprovei e mergeei o PR #${tarefa.pr_numero}`,
  });

  if (sensiveis.length) {
    // Aviso, não bloqueio: o Kauã escolheu autonomia, mas quer saber quando a
    // estrutura muda.
    await supabase.from("notificacoes").insert({
      texto: `PR #${tarefa.pr_numero} mexeu na espinha dorsal (${sensiveis.join(", ")}) e foi mergeado.\n\n${pr.title}`,
      urgencia: "normal",
      tarefa_id: tarefa.id,
    });
  }

  return { fim: "aprovado", pr: tarefa.pr_numero };
}

// ------------------------------------------------------------------ apoio

function interpretar(texto: string): { aprovado: boolean; parecer: string } {
  // O modelo às vezes embrulha o JSON em ```json. Pegamos o primeiro objeto.
  const casou = texto.match(/\{[\s\S]*\}/);
  if (casou) {
    try {
      const obj = JSON.parse(casou[0]) as { aprovado?: unknown; parecer?: unknown };
      return {
        aprovado: obj.aprovado === true,
        parecer: String(obj.parecer ?? texto).slice(0, 4000),
      };
    } catch {
      // cai no fallback
    }
  }
  // Sem JSON legível, o seguro é não aprovar: aprovar por engano mergeia.
  return {
    aprovado: false,
    parecer: `Não consegui ler o parecer como JSON, então não aprovo. Resposta bruta:\n\n${texto.slice(0, 2000)}`,
  };
}

async function pedirMudancas(
  supabase: SupabaseClient,
  revisor: Agente,
  tarefa: Tarefa,
  parecer: string,
): Promise<ResultadoDaRevisao> {
  if (tarefa.pr_numero) {
    await comentarNoPR(
      tarefa.pr_numero,
      `**${revisor.nome}** pediu mudanças.\n\n${parecer}`,
    ).catch(() => {});
  }

  await supabase
    .from("tarefas")
    .update({
      status: "mudancas_pedidas",
      parecer: parecer.slice(0, 4000),
      lock_ate: null,
    })
    .eq("id", tarefa.id);

  await registrarLog(supabase, {
    agente_id: revisor.id,
    tarefa_id: tarefa.id,
    nivel: "warn",
    mensagem: `pedi mudanças no PR #${tarefa.pr_numero}`,
  });

  return { fim: "mudancas", parecer };
}

async function concluir(supabase: SupabaseClient, tarefa: Tarefa, parecer: string) {
  await supabase
    .from("tarefas")
    .update({
      status: "concluida",
      parecer: parecer.slice(0, 4000),
      lock_ate: null,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", tarefa.id);
}

async function registrarExecucao(
  supabase: SupabaseClient,
  revisor: Agente,
  tarefa: Tarefa,
  resposta: { tokensEntrada: number; tokensSaida: number; custo: number; modelo: string },
) {
  await supabase.from("execucoes").insert({
    agente_id: revisor.id,
    tarefa_id: tarefa.id,
    conversa: [],
    encerrada: true,
    modelo: resposta.modelo,
    tokens_entrada: resposta.tokensEntrada,
    tokens_saida: resposta.tokensSaida,
    custo_estimado: resposta.custo,
  });
}
