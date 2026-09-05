import type { Matriz, Paleta } from "./matrizes";
import { ANIMACOES, DURACAO, PALETA_CENARIO, paletaDe } from "./matrizes";

/**
 * Desenha uma matriz como SVG, um `<rect>` por pixel aceso.
 *
 * `shapeRendering="crispEdges"` é o que impede o navegador de suavizar as
 * bordas — sem isso a pixel art vira borrão em tela de alta densidade, que é
 * justamente o oposto do efeito.
 */
export function Pixels({
  matriz,
  paleta,
  className,
}: {
  matriz: Matriz;
  paleta: Paleta;
  className?: string;
}) {
  const largura = matriz[0]?.length ?? 0;
  const altura = matriz.length;

  const pixels: React.ReactElement[] = [];
  matriz.forEach((linha, y) => {
    [...linha].forEach((char, x) => {
      const cor = paleta[char];
      if (!cor) return;
      pixels.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={cor} />,
      );
    });
  });

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {pixels}
    </svg>
  );
}

/**
 * Personagem animado. Os quadros ficam empilhados e o CSS mostra um de cada
 * vez — nenhum timer em JavaScript, o que faz a animação parar sozinha quando
 * a pessoa pede menos movimento no sistema.
 */
export function Personagem({
  sprite,
  status,
  largura = 72,
}: {
  sprite: string;
  status: string;
  largura?: number;
}) {
  const quadros = ANIMACOES[status] ?? ANIMACOES.idle;
  const duracao = DURACAO[status] ?? "2.4s";
  const paleta = paletaDe(sprite);

  if (quadros.length === 1) {
    return (
      <div style={{ width: largura }} className="aspect-[12/13]">
        <Pixels matriz={quadros[0]} paleta={paleta} />
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-[12/13] quadros-${quadros.length}`}
      style={{ width: largura, ["--duracao" as string]: duracao }}
    >
      {quadros.map((matriz, i) => (
        <div
          key={i}
          className="quadro absolute inset-0"
          style={{ animationDelay: `calc(var(--duracao) * ${i} / ${quadros.length})` }}
        >
          <Pixels matriz={matriz} paleta={paleta} />
        </div>
      ))}
    </div>
  );
}

export function Cenario({
  matriz,
  largura,
  paleta = PALETA_CENARIO,
}: {
  matriz: Matriz;
  largura: number;
  paleta?: Paleta;
}) {
  const proporcao = (matriz[0]?.length ?? 1) / matriz.length;
  return (
    <div style={{ width: largura, height: largura / proporcao }}>
      <Pixels matriz={matriz} paleta={paleta} />
    </div>
  );
}
