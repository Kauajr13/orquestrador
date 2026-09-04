import { Janela, Status, Vazio } from "@/components/ui/Janela";
import type { Agente, Meta, Tarefa } from "@/lib/tipos";

/*
  Os painéis de dados. São listas, não tabelas: no celular uma tabela de cinco
  colunas vira rolagem horizontal e ninguém lê. Como lista, a mesma marcação
  serve para as duas larguras.
*/

const ROTULO_TAREFA: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: "na fila", cor: "text-suave" },
  em_andamento: { texto: "em andamento", cor: "text-fosforo" },
  em_revisao: { texto: "em revisão", cor: "text-ciano" },
  mudancas_pedidas: { texto: "mudanças pedidas", cor: "text-ambar" },
  aprovada: { texto: "aprovada", cor: "text-ciano" },
  concluida: { texto: "concluída", cor: "text-apagado" },
  falhou: { texto: "falhou", cor: "text-vermelho" },
  bloqueada: { texto: "travada", cor: "text-vermelho" },
};

export function QuadroDeMeta({ meta }: { meta: Meta | null }) {
  return (
    <Janela titulo="Meta atual" acessorio={meta ? `fase ${meta.ordem} de 4` : undefined}>
      {!meta ? (
        <Vazio>Nenhuma meta ativa. O Gestor precisa escolher uma.</Vazio>
      ) : (
        <div className="space-y-2">
          <h2 className="text-ambar text-base leading-tight">{meta.titulo}</h2>
          <p className="text-sm text-suave leading-snug">{meta.descricao}</p>
          <p className="text-xs text-apagado leading-snug">
            <span className="uppercase tracking-widest">Alvo:</span> {meta.alvo}
          </p>
          {meta.evidencia ? (
            <p className="text-xs text-fosforo border-l-2 border-fosforo pl-2 leading-snug">
              {meta.evidencia}
            </p>
          ) : (
            <p className="text-xs text-apagado">Sem evidência de progresso ainda.</p>
          )}
        </div>
      )}
    </Janela>
  );
}

export function UltimasTarefas({
  tarefas,
  nomes,
}: {
  tarefas: Tarefa[];
  nomes: Record<string, string>;
}) {
  return (
    <Janela titulo="Últimas tarefas" acessorio={`${tarefas.length}`}>
      {!tarefas.length ? (
        <Vazio>A fila está vazia.</Vazio>
      ) : (
        <ul className="divide-y-2 divide-linha -m-3">
          {tarefas.map((t) => {
            const r = ROTULO_TAREFA[t.status] ?? { texto: t.status, cor: "text-suave" };
            return (
              <li key={t.id} className="px-3 py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm leading-tight truncate">{t.titulo}</p>
                  <p className="text-[10px] text-apagado uppercase tracking-wide">
                    {t.agente_id ? (nomes[t.agente_id] ?? "sem dono") : "sem dono"}
                    {t.pr_numero ? ` · PR #${t.pr_numero}` : ""}
                  </p>
                </div>
                <span className={`${r.cor} text-[10px] whitespace-nowrap uppercase`}>
                  {r.texto}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Janela>
  );
}

export function Funcionarios({
  agentes,
  salarios,
}: {
  agentes: Agente[];
  salarios: Record<string, { tokens: number; custo: number }>;
}) {
  return (
    <Janela titulo="Funcionários" acessorio={`${agentes.length} ativos`}>
      <ul className="divide-y-2 divide-linha -m-3">
        {agentes.map((a) => {
          const folha = salarios[a.id];
          return (
            <li key={a.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm leading-tight">
                  {a.nome} <Status status={a.status} />
                </p>
                <p className="text-[10px] text-apagado uppercase tracking-wide">{a.papel}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-ciano">
                  {folha ? formatarTokens(folha.tokens) : "0"}
                </p>
                <p className="text-[10px] text-apagado">tokens no mês</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Janela>
  );
}

/**
 * A folha. O salário de um funcionário é o que ele gastou de token — ideia do
 * Kauã, e funciona: dá noção imediata de quem é caro. O custo em dólar é
 * calculado a preço de mercado mesmo enquanto o provedor está de graça, para a
 * conta não chegar de surpresa quando a promoção acabar.
 */
export function Folha({
  salarios,
  nomes,
  saldo,
}: {
  salarios: Record<string, { tokens: number; custo: number }>;
  nomes: Record<string, string>;
  saldo: number;
}) {
  const linhas = Object.entries(salarios).sort((a, b) => b[1].tokens - a[1].tokens);
  const custoTotal = linhas.reduce((s, [, v]) => s + v.custo, 0);

  return (
    <Janela
      titulo="Folha de pagamento"
      acessorio={new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date())}
    >
      {!linhas.length ? (
        <Vazio>Ninguém trabalhou ainda neste mês.</Vazio>
      ) : (
        <ul className="space-y-1">
          {linhas.map(([id, v]) => (
            <li key={id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{nomes[id] ?? "?"}</span>
              <span className="flex-1 border-b-2 border-dotted border-linha mx-1" />
              <span className="text-ciano">{formatarTokens(v.tokens)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 pt-2 border-t-2 border-linha space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-apagado">Custo a preço de mercado</dt>
          <dd className="text-ambar">US$ {custoTotal.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-apagado">Caixa</dt>
          <dd className={saldo > 0 ? "text-fosforo" : "text-apagado"}>
            R$ {saldo.toFixed(2)}
          </dd>
        </div>
      </dl>

      {saldo <= 0 ? (
        <p className="mt-2 text-[10px] text-apagado leading-snug">
          Sem lucro, a empresa não gasta. Ferramenta que custa dinheiro fica
          recusada até entrar receita.
        </p>
      ) : null}
    </Janela>
  );
}

export function Diario({
  entradas,
  nomes,
}: {
  entradas: { id: string; agente_id: string; dia: string; texto: string }[];
  nomes: Record<string, string>;
}) {
  return (
    <Janela titulo="Diário da empresa">
      {!entradas.length ? (
        <Vazio>Ninguém escreveu ainda hoje.</Vazio>
      ) : (
        <ul className="space-y-3">
          {entradas.map((e) => (
            <li key={e.id}>
              <p className="text-[10px] text-apagado uppercase tracking-wide">
                {nomes[e.agente_id] ?? "alguém"} ·{" "}
                {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
                  new Date(`${e.dia}T12:00:00`),
                )}
              </p>
              <p className="text-sm text-suave leading-snug">{e.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </Janela>
  );
}

function formatarTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
