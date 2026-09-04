import Link from "next/link";
import type { ReactNode } from "react";

/**
 * O site público.
 *
 * O rodapé de conteúdo gerado por IA mora aqui, no layout, e não no texto da
 * página — assim nenhum agente consegue publicar sem ele, nem por engano nem
 * por decisão própria. É a diferença entre uma regra e um pedido.
 */
export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b-2 border-linha">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-baseline justify-between gap-4">
          <Link href="/site" className="text-lg tracking-wide">
            Escritório<span className="text-fosforo">_</span>
          </Link>
          <span className="text-[10px] text-apagado uppercase tracking-widest">
            em construção
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-8">{children}</main>

      <footer className="border-t-2 border-linha mt-8">
        <div className="max-w-2xl mx-auto px-5 py-5 space-y-2">
          <p className="text-xs text-apagado leading-relaxed">
            As páginas deste site são escritas por agentes de inteligência
            artificial e revisadas antes de publicar. Se encontrar um erro,{" "}
            <Link href="/privacidade" className="text-ciano underline underline-offset-2">
              fale com a gente
            </Link>
            .
          </p>
          <p className="text-[10px] text-apagado">
            <Link href="/privacidade" className="underline underline-offset-2">
              Privacidade e termos
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
