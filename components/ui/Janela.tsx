import type { ReactNode } from "react";

/**
 * A moldura de tudo. Barra de título em caixa alta, corpo escuro, sombra dura
 * deslocada 4px — a profundidade vem do deslocamento, nunca de desfoque, que é
 * o que mantém a interface coerente com a pixel art.
 */
export function Janela({
  titulo,
  acessorio,
  children,
  className = "",
  semPadding = false,
}: {
  titulo: string;
  acessorio?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section className={`janela flex flex-col min-h-0 ${className}`}>
      <header className="janela-titulo flex items-center justify-between gap-2 shrink-0">
        <span>{titulo}</span>
        {acessorio ? <span className="text-suave normal-case">{acessorio}</span> : null}
      </header>
      <div className={`min-h-0 flex-1 ${semPadding ? "" : "p-3"}`}>{children}</div>
    </section>
  );
}

const CORES: Record<string, string> = {
  idle: "text-suave",
  working: "text-fosforo",
  done: "text-ciano",
  descansando: "text-apagado",
  error: "text-vermelho",
};

const ROTULOS: Record<string, string> = {
  idle: "livre",
  working: "trabalhando",
  done: "entregou",
  descansando: "descansando",
  error: "travado",
};

export function Status({ status }: { status: string }) {
  return (
    <span className={`${CORES[status] ?? "text-suave"} text-xs`}>
      [{ROTULOS[status] ?? status}]
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-apagado text-sm py-6 text-center">{children}</p>;
}
