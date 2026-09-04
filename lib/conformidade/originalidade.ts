/**
 * Checagem de originalidade. Parte da regra 5 da constituição.
 *
 * Um agente que acabou de ler cinco páginas sobre um assunto e escreve um texto
 * sobre ele tende a reproduzir trechos sem perceber. O conteúdo sai sob o
 * domínio de uma pessoa real, que responde por direito autoral — então a
 * verificação acontece antes de publicar, não depois de alguém reclamar.
 *
 * Oito palavras seguidas é o limiar. Abaixo disso, coincidência é comum em
 * português (expressões feitas, termos técnicos, nomes de produto). Acima,
 * já é cópia.
 */

const PALAVRAS_LIMITE = 8;

function normalizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngramas(palavras: string[], n: number): Set<string> {
  const conjunto = new Set<string>();
  for (let i = 0; i + n <= palavras.length; i++) {
    conjunto.add(palavras.slice(i, i + n).join(" "));
  }
  return conjunto;
}

export type ResultadoDaChecagem =
  | { original: true }
  | { original: false; trecho: string; origem: string };

export function checarOriginalidade(
  texto: string,
  fontes: { url: string; texto: string }[],
): ResultadoDaChecagem {
  const palavras = normalizar(texto);
  if (palavras.length < PALAVRAS_LIMITE) return { original: true };

  const doTexto = ngramas(palavras, PALAVRAS_LIMITE);

  for (const fonte of fontes) {
    const daFonte = ngramas(normalizar(fonte.texto), PALAVRAS_LIMITE);
    for (const g of doTexto) {
      if (daFonte.has(g)) {
        return { original: false, trecho: g, origem: fonte.url };
      }
    }
  }

  return { original: true };
}
