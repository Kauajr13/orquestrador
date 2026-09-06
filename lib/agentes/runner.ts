import type { SupabaseClient } from "@supabase/supabase-js";
import { AIErro, conversar, type FerramentaDeclarada } from "@/lib/ai";
import { podeGastar } from "@/lib/caixa";
import { registrarLog } from "@/lib/log";
import type { Agente, Execucao, Mensagem, Tarefa } from "@/lib/tipos";
import type { Contexto, Ferramenta } from "./ferramentas/tipos";

/**
 * O runner é onde um agente efetivamente trabalha: recebe uma tarefa, conversa
 * com o modelo, executa as ferramentas que ele pedir e devolve o controle.
 *
 * A restrição que molda tudo aqui: função da Vercel morre em 60 segundos, e o
 * raciocínio de um agente não cabe nisso. Então cada tick avança um pedaço e
 * salva a conversa em `execucoes.conversa`; o próximo tick lê e continua. É o
 * que permite um agente longo rodar em serverless sem estado próprio.
 */

/** Sobra pro que vem depois do loop: salvar conversa, atualizar tarefa, logar. */
const ORCAMENTO_MS = 42_000;

/** Mesma ferramenta com os mesmos argumentos tantas vezes seguidas = travou. */
const REPETICOES_ATE_DESISTIR = 3;

export type ResultadoDoPasso =
  | { fim: "continua"; passos: number }
  | { fim: "concluido"; resposta: string; passos: number }
  | { fim: "erro"; motivo: string; passos: number };

export async function executarPasso(
  supabase: SupabaseClient,
  agente: Agente,
  tarefa: Tarefa,
  catalogo: Ferramenta[],
  promptBase: string,
  tetoPassos: number,
): Promise<ResultadoDoPasso> {
  const inicio = Date.now();
  const disponiveis = catalogo.filter((f) => agente.ferramentas.includes(f.nome));
  const declaradas = disponiveis.map(declarar);

  const execucao = await carregarOuCriarExecucao(supabase, agente, tarefa, promptBase);
  const mensagens: Mensagem[] = [...execucao.conversa];

  const ctx: Contexto = {
    supabase,
    agente,
    tarefa,
    // Carrega o que já foi lido em ticks anteriores. Sem isto o agente perde a
    // pesquisa a cada invocação, refaz o mesmo trabalho e nunca consegue
    // anotar nada — a regra 11 recusaria por "fonte não lida".
    fontesLidas: [...(execucao.fontes ?? [])],
    skillsCarregadas: new Set<string>(),
    registrar: (nivel, mensagem) =>
      registrarLog(supabase, {
        agente_id: agente.id,
        tarefa_id: tarefa.id,
        nivel,
        mensagem,
      }),
  };

  let passos = tarefa.passos;
  let tokensEntrada = execucao.tokens_entrada;
  let tokensSaida = execucao.tokens_saida;
  let custo = Number(execucao.custo_estimado);
  const ultimasChamadas: string[] = [];

  while (Date.now() - inicio < ORCAMENTO_MS) {
    if (passos >= tetoPassos) {
      await salvar(supabase, execucao.id, mensagens, {
        tokensEntrada,
        tokensSaida,
        custo,
        encerrada: true,
        fontes: ctx.fontesLidas,
      });
      return {
        fim: "erro",
        motivo: `estourou o teto de ${tetoPassos} passos sem concluir`,
        passos,
      };
    }

    let resposta;
    try {
      resposta = await conversar(janela(mensagens, ctx.fontesLidas), {
        ferramentas: declaradas.length ? declaradas : undefined,
        tipo: tipoDeTrabalho(agente),
        modelo: agente.modelo,
      });
    } catch (e) {
      // Free tier limita requisições por minuto, e um agente pensando com
      // ferramentas faz várias chamadas seguidas. Bater no teto não é erro do
      // agente nem motivo para contar tentativa: guardamos o que já foi
      // raciocinado e o próximo tick continua, quinze minutos depois, com a
      // cota recuperada. É para isto que a execução é retomável.
      // O modelo pediu ferramenta que não existe no kit dele. O provedor
      // recusa a requisição inteira, então sem isto a tentativa se perde por um
      // engano que o próprio agente consegue corrigir se souber. Contamos como
      // passo para não virar laço, e devolvemos a lista do que ele tem.
      const inexistente = e instanceof AIErro ? e.ferramentaInexistente : null;
      if (inexistente) {
        passos += 1;
        mensagens.push({
          role: "user",
          content: `A ferramenta "${inexistente}" não existe no seu kit. As suas são: ${
            disponiveis.map((f) => f.nome).join(", ") || "nenhuma"
          }. Siga com uma delas, ou abra uma tarefa pedindo acesso se precisar mesmo daquela.`,
        });
        await ctx.registrar("warn", `tentei usar ${inexistente}, que não tenho`);
        await salvar(supabase, execucao.id, mensagens, {
          tokensEntrada,
          tokensSaida,
          custo,
          encerrada: false,
        });
        continue;
      }

      if (e instanceof AIErro && (e.status === 429 || e.status === 503)) {
        await salvar(supabase, execucao.id, mensagens, {
          tokensEntrada,
          tokensSaida,
          custo,
          encerrada: false,
        });
        await ctx.registrar(
          "warn",
          e.status === 429
            ? "bati no limite de requisições do provedor; continuo no próximo tick"
            : "provedor sobrecarregado; continuo no próximo tick",
        );
        return { fim: "continua", passos };
      }
      throw e;
    }

    passos += 1;
    tokensEntrada += resposta.tokensEntrada;
    tokensSaida += resposta.tokensSaida;
    custo += resposta.custo;

    mensagens.push({
      role: "assistant",
      content: resposta.conteudo,
      ...(resposta.chamadas.length ? { tool_calls: resposta.chamadas } : {}),
    });

    // Sem ferramenta pedida, o agente considerou a tarefa encerrada.
    if (resposta.parou) {
      await salvar(supabase, execucao.id, mensagens, {
        tokensEntrada,
        tokensSaida,
        custo,
        encerrada: true,
        fontes: ctx.fontesLidas,
      });
      return { fim: "concluido", resposta: resposta.conteudo ?? "", passos };
    }

    for (const chamada of resposta.chamadas) {
      const assinatura = `${chamada.function.name}:${chamada.function.arguments}`;
      ultimasChamadas.push(assinatura);

      if (repetiuDemais(ultimasChamadas)) {
        await ctx.registrar(
          "erro",
          `repeti ${chamada.function.name} com os mesmos argumentos ${REPETICOES_ATE_DESISTIR} vezes; parei`,
        );
        await salvar(supabase, execucao.id, mensagens, {
          tokensEntrada,
          tokensSaida,
          custo,
          encerrada: true,
        });
        return {
          fim: "erro",
          motivo: `travou repetindo ${chamada.function.name}`,
          passos,
        };
      }

      const saida = await executarFerramenta(chamada, disponiveis, ctx);
      mensagens.push({
        role: "tool",
        tool_call_id: chamada.id,
        name: chamada.function.name,
        content: saida,
      });
    }

    // Salva a cada volta: se o tick morrer agora, o próximo retoma daqui em vez
    // de refazer (e repagar) tudo o que já foi feito.
    await salvar(supabase, execucao.id, mensagens, {
      tokensEntrada,
      tokensSaida,
      custo,
      encerrada: false,
      fontes: ctx.fontesLidas,
    });
  }

  return { fim: "continua", passos };
}

// ------------------------------------------------------------------ apoio

function tipoDeTrabalho(agente: Agente) {
  // Código e decisão estratégica pedem o modelo grande; o resto (pesquisar,
  // resumir, escrever) roda bem no pequeno e custa uma fração.
  return agente.papel === "dev" || agente.papel === "gestor" || agente.papel === "revisor"
    ? ("caro" as const)
    : ("barato" as const);
}

function declarar(f: Ferramenta): FerramentaDeclarada {
  return {
    type: "function",
    function: { name: f.nome, description: f.descricao, parameters: f.parametros },
  };
}

/**
 * Quantas mensagens recentes seguem no prompt, além do começo da conversa.
 *
 * Seis, e não mais, porque o orçamento é apertado: medindo uma conversa real,
 * o prompt do sistema levava 1300 tokens, os schemas das ferramentas outros
 * 2500, e cada resultado de ferramenta perto de 600. Com doze mensagens a
 * requisição passava dos 8 mil tokens por minuto que o provedor gratuito
 * concede, e o agente parava de avançar.
 */
const JANELA = 6;

/**
 * O que vai para o modelo: o começo da conversa mais as mensagens recentes.
 *
 * A conversa inteira é reenviada a cada turno, então ela cresce a cada passo e
 * o prompt engorda junto. Provedor gratuito corta requisição acima de 8 mil
 * tokens por minuto — sem esta janela, toda tarefa longa morre no meio, e a
 * conta de uma tarefa paga cresce ao quadrado do número de passos.
 *
 * O histórico completo continua salvo em `execucoes.conversa`: o que se encurta
 * é o que se manda, não o que se guarda.
 */
function janela(
  mensagens: Mensagem[],
  fontes: { url: string; texto: string }[] = [],
): Mensagem[] {
  if (mensagens.length <= JANELA + 2 && !fontes.length) return mensagens;

  // O que saiu da janela vira uma linha de resumo. Sem isso o agente repete
  // trabalho que já fez — foi visto carregando a mesma skill duas vezes e
  // refazendo buscas — e cada repetição custa um passo e um pedaço da cota.
  const cortadas = mensagens.slice(2, -JANELA);
  const usadas = new Map<string, number>();
  for (const m of cortadas) {
    if (m.role === "assistant" && m.tool_calls) {
      for (const c of m.tool_calls) {
        usadas.set(c.function.name, (usadas.get(c.function.name) ?? 0) + 1);
      }
    }
  }

  const partes: string[] = [];

  if (usadas.size) {
    partes.push(
      `Você já usou: ${[...usadas]
        .map(([nome, n]) => (n > 1 ? `${nome} ${n}x` : nome))
        .join(", ")}.`,
    );
  }

  // Listar o que já foi lido é o que impede o agente de gastar busca atrás de
  // página que ele mesmo já abriu — e é o que permite citá-las ao anotar, já
  // que a regra 11 só aceita fonte efetivamente lida.
  if (fontes.length) {
    partes.push(
      `Fontes que você já leu nesta tarefa (pode citá-las ao anotar, sem buscar de novo):`,
      ...fontes.slice(-12).map((f) => `- ${f.url}`),
    );
  }

  const resumo: Mensagem[] = partes.length
    ? [
        {
          role: "user",
          content: `[memória de trabalho desta tarefa, do que ficou fora do trecho abaixo]\n${partes.join("\n")}\nNão repita o que já está feito; siga de onde parou.`,
        },
      ]
    : [];

  // As duas primeiras são o system e a tarefa — sem elas o agente esquece quem
  // é e o que estava fazendo.
  const inicio = mensagens.slice(0, 2);
  let recentes = mensagens.slice(-JANELA);

  // Uma resposta com tool_calls precisa ser seguida dos resultados dela. Se o
  // corte cair no meio desse par, a API recusa a conversa inteira.
  while (recentes.length && recentes[0].role === "tool") recentes = recentes.slice(1);

  return [...inicio, ...resumo, ...recentes];
}

function repetiuDemais(assinaturas: string[]): boolean {
  if (assinaturas.length < REPETICOES_ATE_DESISTIR) return false;
  const ultimas = assinaturas.slice(-REPETICOES_ATE_DESISTIR);
  return ultimas.every((a) => a === ultimas[0]);
}

/**
 * Executa uma ferramenta e devolve o resultado como texto para o modelo.
 *
 * Erro de ferramenta volta como conteúdo, não como exceção: o agente precisa
 * poder ler "isso falhou porque X" e tentar outro caminho. Derrubar o tick
 * inteiro por um argumento errado desperdiçaria todo o raciocínio anterior.
 */
async function executarFerramenta(
  chamada: { id: string; function: { name: string; arguments: string } },
  disponiveis: Ferramenta[],
  ctx: Contexto,
): Promise<string> {
  const ferramenta = disponiveis.find((f) => f.nome === chamada.function.name);

  if (!ferramenta) {
    return `erro: você não tem a ferramenta "${chamada.function.name}". Se ela resolveria o problema, abra uma tarefa pedindo acesso.`;
  }

  let argumentos: Record<string, unknown>;
  try {
    argumentos = chamada.function.arguments ? JSON.parse(chamada.function.arguments) : {};
  } catch {
    return `erro: os argumentos não são JSON válido. Recebi: ${chamada.function.arguments.slice(0, 200)}`;
  }

  if (ferramenta.custa) {
    const { pode, saldo } = await podeGastar(ctx.supabase);
    if (!pode) {
      return `erro: "${ferramenta.nome}" custa dinheiro e o caixa está em ${saldo.toFixed(2)}. A empresa não gasta o que não ganhou — peça providência ao chefe se for indispensável.`;
    }
  }

  try {
    await ctx.registrar("info", `usei ${ferramenta.nome}`);
    const saida = await ferramenta.executar(argumentos, ctx);
    // Teto de tamanho, e ele precisa ser apertado: a conversa é reenviada
    // inteira a cada turno, então um resultado grande não pesa uma vez — pesa
    // em todos os turnos seguintes. Um único retorno de 12 mil caracteres foi
    // suficiente para travar o agente contra o limite de tokens por minuto.
    return saida.length > 2_500 ? `${saida.slice(0, 2_500)}\n[…truncado]` : saida;
  } catch (e) {
    const motivo = (e as Error).message;
    await ctx.registrar("erro", `${ferramenta.nome} falhou: ${motivo}`);
    return `erro ao executar ${ferramenta.nome}: ${motivo}`;
  }
}

async function carregarOuCriarExecucao(
  supabase: SupabaseClient,
  agente: Agente,
  tarefa: Tarefa,
  promptBase: string,
): Promise<Execucao> {
  const { data: aberta } = await supabase
    .from("execucoes")
    .select("*")
    .eq("tarefa_id", tarefa.id)
    .eq("encerrada", false)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aberta) return aberta as Execucao;

  const conversa: Mensagem[] = [
    { role: "system", content: promptBase },
    {
      role: "user",
      content: `Tarefa: ${tarefa.titulo}\n\n${tarefa.descricao}`,
    },
  ];

  const { data, error } = await supabase
    .from("execucoes")
    .insert({ agente_id: agente.id, tarefa_id: tarefa.id, conversa })
    .select("*")
    .single();

  if (error) throw new Error(`não consegui abrir execução: ${error.message}`);
  return data as Execucao;
}

async function salvar(
  supabase: SupabaseClient,
  execucaoId: string,
  conversa: Mensagem[],
  n: {
    tokensEntrada: number;
    tokensSaida: number;
    custo: number;
    encerrada: boolean;
    fontes?: { url: string; texto: string }[];
  },
): Promise<void> {
  const { error } = await supabase
    .from("execucoes")
    .update({
      conversa,
      ...(n.fontes ? { fontes: n.fontes } : {}),
      tokens_entrada: n.tokensEntrada,
      tokens_saida: n.tokensSaida,
      custo_estimado: n.custo,
      encerrada: n.encerrada,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  if (error) throw new Error(`não consegui salvar a execução: ${error.message}`);
}
