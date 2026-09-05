"use client";

import { useEffect, useMemo, useState } from "react";
import { Cenario, Personagem } from "@/components/sprites/Sprite";
import { CAFE, MONITOR, PALETA_CENARIO, PLANTA } from "@/components/sprites/matrizes";
import { supabaseDoNavegador, temSupabaseNoNavegador } from "@/lib/supabase/browser";
import type { Agente, Tarefa, Time } from "@/lib/tipos";

/**
 * A sala.
 *
 * Cresce sozinha: quando o Gestor contrata alguém, o Realtime traz a linha nova
 * e mais uma mesa aparece. Quando ele cria um time, a sala se divide. Ver o
 * escritório encher é a recompensa de acompanhar a empresa — e é a razão de
 * isto existir em vez de uma tabela de status.
 */
export function Sala({
  agentesIniciais,
  tarefasIniciais,
  times,
  escalado,
}: {
  agentesIniciais: Agente[];
  tarefasIniciais: Tarefa[];
  times: Time[];
  escalado: boolean;
}) {
  const [agentes, setAgentes] = useState(agentesIniciais);
  const [tarefas, setTarefas] = useState(tarefasIniciais);

  useEffect(() => {
    if (!temSupabaseNoNavegador()) return;
    const supabase = supabaseDoNavegador();

    const canal = supabase
      .channel("escritorio")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agentes" },
        (evento) => {
          setAgentes((atuais) => aplicar(atuais, evento));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        (evento) => {
          setTarefas((atuais) => aplicar(atuais, evento));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const porTime = useMemo(() => {
    const ativos = agentes.filter((a) => a.ativo);
    const grupos: { time: Time | null; membros: Agente[] }[] = [];

    for (const time of times) {
      const membros = ativos.filter((a) => a.time_id === time.id);
      if (membros.length) grupos.push({ time, membros });
    }

    const semTime = ativos.filter((a) => !a.time_id || !times.some((t) => t.id === a.time_id));
    if (semTime.length) grupos.push({ time: null, membros: semTime });

    return grupos;
  }, [agentes, times]);

  const tarefaDe = (agenteId: string) =>
    tarefas.find(
      (t) =>
        t.agente_id === agenteId &&
        (t.status === "em_andamento" || t.status === "em_revisao"),
    );

  return (
    <div className="janela overflow-hidden min-w-0 w-full">
      <SalaDoChefe acesa={escalado} />

      <div className="parede px-4 pt-4 pb-2 flex items-start justify-between gap-4">
        <Relogio />
        <div className="hidden sm:block">
          <Cenario matriz={PLANTA} largura={40} paleta={PALETA_CENARIO} />
        </div>
      </div>

      <div className="piso overflow-x-auto">
        <div className="flex gap-6 px-4 py-5 min-w-max items-end">
          {porTime.map(({ time, membros }) => (
            <div key={time?.id ?? "sem-time"} className="flex flex-col gap-2">
              {time ? (
                <span className="text-[10px] uppercase tracking-widest text-apagado">
                  {time.nome}
                </span>
              ) : null}
              <div className="flex gap-5 items-end">
                {membros.map((agente) => (
                  <Mesa key={agente.id} agente={agente} tarefa={tarefaDe(agente.id)} />
                ))}
              </div>
            </div>
          ))}

          {/* A cafeteira fica no canto, como num escritório de verdade — solta
              no meio do piso ela vira enfeite perdido. */}
          <div className="self-end pb-1 ml-auto pl-8 hidden sm:block">
            <Cenario matriz={CAFE} largura={36} paleta={PALETA_CENARIO} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Mesa({ agente, tarefa }: { agente: Agente; tarefa?: Tarefa }) {
  const trabalhando = agente.status === "working";
  const paletaMonitor = {
    ...PALETA_CENARIO,
    // O monitor acende conforme o estado: é o sinal que se lê de longe.
    S:
      agente.status === "error"
        ? "#5c1f22"
        : trabalhando
          ? "#123a2c"
          : agente.status === "descansando"
            ? "#0d1218"
            : "#16202b",
  };

  return (
    <figure className="flex flex-col items-center gap-1 w-[104px] shrink-0">
      {tarefa ? (
        <figcaption
          className="text-[10px] leading-tight text-ciano text-center h-8 px-1 line-clamp-2"
          title={tarefa.titulo}
        >
          {tarefa.titulo}
        </figcaption>
      ) : (
        <div className="h-8" />
      )}

      <div className="relative flex flex-col items-center">
        <Personagem sprite={agente.sprite} status={agente.status} largura={72} />
        <div className="-mt-1">
          <Cenario matriz={MONITOR} largura={52} paleta={paletaMonitor} />
        </div>
        {/* A mesa */}
        <div className="w-[104px] h-[10px] bg-[#3a2f26] border-t-2 border-[#5a483a]" />
      </div>

      <figcaption className="text-center leading-tight">
        <span className="block text-xs">{agente.nome}</span>
        <span className="block text-[10px] text-apagado uppercase tracking-wide">
          {agente.papel}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * A sala do chefe. Acende quando alguma coisa foi escalada para o Kauã — é o
 * jeito de ele bater o olho e saber que precisa aparecer, sem abrir o Telegram.
 */
function SalaDoChefe({ acesa }: { acesa: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 border-b-2 ${
        acesa ? "sala-acesa border-ambar bg-[#241d10]" : "border-linha bg-rodape"
      }`}
    >
      <span className="text-xs uppercase tracking-widest text-suave">Sala do chefe</span>
      <span className={`text-xs ${acesa ? "text-ambar brilho-vivo" : "text-apagado"}`}>
        {acesa ? "● precisa de você" : "○ tudo sob controle"}
      </span>
    </div>
  );
}

function Relogio() {
  const [hora, setHora] = useState<string>("");

  useEffect(() => {
    const formatar = () =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

    setHora(formatar());
    const id = setInterval(() => setHora(formatar()), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border-2 border-linha bg-rodape px-3 py-1">
      <span className="font-[family-name:var(--font-terminal)] text-2xl text-ambar leading-none">
        {hora || "--:--"}
      </span>
      <span className="block text-[10px] text-apagado uppercase tracking-widest">
        Brasília
      </span>
    </div>
  );
}

/**
 * O Realtime entrega linha crua (`{[coluna]: any}`), sem saber a forma da
 * tabela. A conversão acontece aqui, num lugar só, em vez de espalhar `as` por
 * cada assinatura.
 */
type EventoBruto = {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function aplicar<T extends { id: string }>(atuais: T[], evento: EventoBruto): T[] {
  if (evento.eventType === "DELETE") {
    const id = evento.old?.id as string | undefined;
    return id ? atuais.filter((i) => i.id !== id) : atuais;
  }

  const linha = evento.new as unknown as T;
  if (!linha?.id) return atuais;

  if (evento.eventType === "INSERT") {
    // O INSERT pode chegar duas vezes (reconexão do canal); não duplicar mesa.
    return atuais.some((i) => i.id === linha.id) ? atuais : [...atuais, linha];
  }

  return atuais.map((i) => (i.id === linha.id ? linha : i));
}
