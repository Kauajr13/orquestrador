import type { SupabaseClient } from "@supabase/supabase-js";
import { conversar, type FerramentaDeclarada } from "@/lib/ai";
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
    fontesLidas: [],
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
      });
      return {
        fim: "erro",
        motivo: `estourou o teto de ${tetoPassos} passos sem concluir`,
        passos,
      };
    }

    const resposta = await conversar(mensagens, {
      ferramentas: declaradas.length ? declaradas : undefined,
      tipo: tipoDeTrabalho(agente),
      modelo: agente.modelo,
    });

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
    // Teto de tamanho: uma página inteira na conversa estoura o contexto e
    // encarece cada turno seguinte, porque a conversa é reenviada por completo.
    return saida.length > 12_000 ? `${saida.slice(0, 12_000)}\n[…truncado]` : saida;
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
  n: { tokensEntrada: number; tokensSaida: number; custo: number; encerrada: boolean },
): Promise<void> {
  const { error } = await supabase
    .from("execucoes")
    .update({
      conversa,
      tokens_entrada: n.tokensEntrada,
      tokens_saida: n.tokensSaida,
      custo_estimado: n.custo,
      encerrada: n.encerrada,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", execucaoId);

  if (error) throw new Error(`não consegui salvar a execução: ${error.message}`);
}
