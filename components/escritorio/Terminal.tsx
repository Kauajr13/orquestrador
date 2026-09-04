"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseDoNavegador, temSupabaseNoNavegador } from "@/lib/supabase/browser";
import type { Log } from "@/lib/tipos";

const COR: Record<string, string> = {
  info: "text-fosforo",
  sucesso: "text-ciano",
  warn: "text-ambar",
  erro: "text-vermelho",
};

/**
 * O log ao vivo.
 *
 * Chega por Realtime, sem polling: a tabela `logs` está na publicação do
 * Postgres, então cada linha que um agente escreve aparece aqui no mesmo
 * instante. É o que faz a empresa parecer acordada.
 */
export function Terminal({
  iniciais,
  nomes,
}: {
  iniciais: Log[];
  nomes: Record<string, string>;
}) {
  const [linhas, setLinhas] = useState<Log[]>(iniciais);
  const [colado, setColado] = useState(true);
  const fim = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!temSupabaseNoNavegador()) return;
    const supabase = supabaseDoNavegador();
    const canal = supabase
      .channel("terminal")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (evento) => {
          // Teto de 300 linhas: um dia inteiro de log na memória do navegador
          // deixa a página pesada sem nenhum ganho — o histórico está no banco.
          setLinhas((atuais) => [...atuais, evento.new as Log].slice(-300));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // Só rola sozinho se a pessoa já estava no fim. Puxar o histórico e ser
  // arrastado de volta pelo autoscroll é irritante.
  useEffect(() => {
    if (colado) fim.current?.scrollIntoView({ block: "end" });
  }, [linhas, colado]);

  function aoRolar() {
    const el = caixa.current;
    if (!el) return;
    setColado(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }

  // Colado embaixo: terminal de verdade cresce do rodapé para cima, e assim o
  // espaço vazio de um escritório quieto fica no topo, não no meio da tela.
  return (
    <div
      ref={caixa}
      onScroll={aoRolar}
      className="terminal h-full overflow-y-auto p-3 flex flex-col justify-end"
      role="log"
      aria-live="polite"
      aria-label="Log do escritório"
    >
      {linhas.length === 0 ? (
        <p className="text-apagado">
          escritório em silêncio. o próximo tick acorda alguém.
        </p>
      ) : (
        linhas.map((linha) => (
          <p key={linha.id} className="whitespace-pre-wrap break-words">
            <span className="text-apagado">{hora(linha.criado_em)} </span>
            {linha.agente_id ? (
              <span className="text-ciano">
                {nomes[linha.agente_id] ?? "alguém"}:{" "}
              </span>
            ) : null}
            <span className={COR[linha.nivel] ?? "text-fosforo"}>{linha.mensagem}</span>
          </p>
        ))
      )}
      <div ref={fim} className="cursor text-fosforo" />
    </div>
  );
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}
