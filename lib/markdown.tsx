import type { ReactNode } from "react";

/**
 * Markdown mínimo, renderizado como React.
 *
 * Por que não uma biblioteca: quase todas devolvem string de HTML, e usar isso
 * exigiria `dangerouslySetInnerHTML`. O texto aqui é escrito por agentes de IA
 * a partir de páginas que eles leram na internet — ou seja, conteúdo de origem
 * pouco confiável saindo sob o domínio de uma pessoa real. Construindo os
 * elementos, uma tag `<script>` no meio do texto é só texto.
 *
 * Suporta o que uma página de conteúdo precisa: títulos, parágrafos, listas,
 * citação, código, negrito, itálico e link.
 */

export function Markdown({ texto }: { texto: string }) {
  return <>{blocos(texto)}</>;
}

function blocos(texto: string): ReactNode[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const saida: ReactNode[] = [];

  let paragrafo: string[] = [];
  let lista: string[] | null = null;
  let listaOrdenada = false;
  let codigo: string[] | null = null;
  let chave = 0;

  const fecharParagrafo = () => {
    if (!paragrafo.length) return;
    saida.push(
      <p key={chave++} className="mb-4 leading-relaxed">
        {inline(paragrafo.join(" "))}
      </p>,
    );
    paragrafo = [];
  };

  const fecharLista = () => {
    if (!lista?.length) return;
    const itens = lista.map((item, i) => (
      <li key={i} className="mb-1">
        {inline(item)}
      </li>
    ));
    saida.push(
      listaOrdenada ? (
        <ol key={chave++} className="mb-4 pl-5 list-decimal">
          {itens}
        </ol>
      ) : (
        <ul key={chave++} className="mb-4 pl-5 list-disc">
          {itens}
        </ul>
      ),
    );
    lista = null;
  };

  for (const linha of linhas) {
    if (linha.trim().startsWith("```")) {
      if (codigo) {
        saida.push(
          <pre
            key={chave++}
            className="mb-4 p-3 overflow-x-auto border-2 border-linha bg-fundo text-sm"
          >
            <code>{codigo.join("\n")}</code>
          </pre>,
        );
        codigo = null;
      } else {
        fecharParagrafo();
        fecharLista();
        codigo = [];
      }
      continue;
    }

    if (codigo) {
      codigo.push(linha);
      continue;
    }

    if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
      continue;
    }

    const titulo = linha.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      const nivel = titulo[1].length;
      const conteudo = inline(titulo[2]);
      const classe =
        nivel <= 2
          ? "text-xl mt-8 mb-3 text-ambar"
          : "text-base mt-6 mb-2 text-ciano uppercase tracking-wide";
      saida.push(
        nivel <= 2 ? (
          <h2 key={chave++} className={classe}>
            {conteudo}
          </h2>
        ) : (
          <h3 key={chave++} className={classe}>
            {conteudo}
          </h3>
        ),
      );
      continue;
    }

    const citacao = linha.match(/^>\s?(.*)$/);
    if (citacao) {
      fecharParagrafo();
      fecharLista();
      saida.push(
        <blockquote
          key={chave++}
          className="mb-4 pl-3 border-l-2 border-linha-forte text-suave"
        >
          {inline(citacao[1])}
        </blockquote>,
      );
      continue;
    }

    const itemLista = linha.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (itemLista) {
      fecharParagrafo();
      const ordenada = /\d/.test(itemLista[1]);
      if (!lista || ordenada !== listaOrdenada) {
        fecharLista();
        lista = [];
        listaOrdenada = ordenada;
      }
      lista.push(itemLista[2]);
      continue;
    }

    paragrafo.push(linha.trim());
  }

  fecharParagrafo();
  fecharLista();
  if (codigo) {
    saida.push(
      <pre key={chave++} className="mb-4 p-3 overflow-x-auto border-2 border-linha bg-fundo text-sm">
        <code>{codigo.join("\n")}</code>
      </pre>,
    );
  }

  return saida;
}

/** Negrito, itálico, código e link. Tudo o mais fica sendo texto puro. */
function inline(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const padrao = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

  let ultimo = 0;
  let achado: RegExpExecArray | null;
  let chave = 0;

  while ((achado = padrao.exec(texto)) !== null) {
    if (achado.index > ultimo) partes.push(texto.slice(ultimo, achado.index));
    const t = achado[0];

    if (t.startsWith("**")) {
      partes.push(<strong key={chave++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("`")) {
      partes.push(
        <code key={chave++} className="text-ciano">
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith("[")) {
      const link = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link && seguro(link[2])) {
        partes.push(
          <a
            key={chave++}
            href={link[2]}
            className="text-ciano underline underline-offset-2"
            rel="noopener noreferrer nofollow"
            target={link[2].startsWith("/") ? undefined : "_blank"}
          >
            {link[1]}
          </a>,
        );
      } else {
        partes.push(link ? link[1] : t);
      }
    } else {
      partes.push(<em key={chave++}>{t.slice(1, -1)}</em>);
    }

    ultimo = achado.index + t.length;
  }

  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** `javascript:` num link é execução de código disfarçada de endereço. */
function seguro(href: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:)/i.test(href);
}
