/**
 * Pixel art em matriz de texto. Cada caractere é um índice de cor; `.` é
 * transparente.
 *
 * É desenho em código de propósito: nasce nítido em qualquer tela, aparece
 * legível num diff (dá pra ver o que mudou num sprite), recolore sozinho quando
 * a paleta muda, e não traz nenhum binário nem licença de terceiro pro
 * repositório.
 *
 * Convenção de cores nos personagens:
 *   1 cabelo   2 pele   3 roupa   4 sombra da roupa   5 olho   6 detalhe
 */

export type Matriz = readonly string[];

// ------------------------------------------------------------- personagem

// De frente, sentado. 12 de largura por 13 de altura — pequeno o bastante para
// caber várias mesas na tela, grande o bastante para ter expressão.

const CABECA = [
  "....1111....",
  "...111111...",
  "..11111111..",
  "..12222221..",
] as const;

const idle1: Matriz = [
  ...CABECA,
  "..15222251..",
  "..12222221..",
  "...122221...",
  "....2222....",
  "..33333333..",
  ".4333333334.",
  ".2333333332.",
  ".2344334432.",
  "..33....33..",
];

// A respiração: o tronco sobe um pixel. Só isso, e o personagem deixa de
// parecer congelado.
const idle2: Matriz = [
  ...CABECA,
  "..15222251..",
  "..12222221..",
  "...122221...",
  "....2222....",
  "...333333...",
  "..33333333..",
  ".4333333334.",
  ".2344334432.",
  "..33....33..",
];

// Digitando: as mãos vão pra frente, alternando.
const trabalhando1: Matriz = [
  ...CABECA,
  "..15222251..",
  "..12222221..",
  "...122221...",
  "....2222....",
  "..33333333..",
  ".4333333334.",
  ".3333333333.",
  ".2333333332.",
  "..22....33..",
];

const trabalhando2: Matriz = [
  ...CABECA,
  "..15222251..",
  "..12222221..",
  "...122221...",
  "....2222....",
  "..33333333..",
  ".4333333334.",
  ".3333333333.",
  ".2333333332.",
  "..33....22..",
];

// Descansando: cabeça na mesa, olhos fechados (a linha do olho vira cabelo).
const descansando1: Matriz = [
  "............",
  "............",
  "....1111....",
  "...111111...",
  "..11111111..",
  "..12222221..",
  "..11222211..",
  "...222222...",
  "..33333333..",
  ".4333333334.",
  ".2333333332.",
  ".2344334432.",
  "..33....33..",
];

const descansando2: Matriz = [
  "............",
  "............",
  "....1111....",
  "...111111...",
  "..11111111..",
  "..12222221..",
  "..11222211..",
  "...222222...",
  "...333333...",
  "..33333333..",
  ".4333333334.",
  ".2344334432.",
  "..33....33..",
];

// Erro: braços caídos, olhos arregalados.
const erro: Matriz = [
  ...CABECA,
  "..16222261..",
  "..12222221..",
  "...122221...",
  "....2222....",
  "..33333333..",
  ".4333333334.",
  ".2333333332.",
  ".2333333332.",
  "..22....22..",
];

export const ANIMACOES: Record<string, Matriz[]> = {
  idle: [idle1, idle2],
  working: [trabalhando1, trabalhando2, trabalhando1, idle1],
  done: [idle1, idle2],
  descansando: [descansando1, descansando2],
  error: [erro],
};

/** Quanto tempo um ciclo inteiro leva, por estado. */
export const DURACAO: Record<string, string> = {
  idle: "2.4s",
  working: "0.7s",
  done: "2.4s",
  descansando: "3.6s",
  error: "1s",
};

// ----------------------------------------------------------------- paletas

export type Paleta = Record<string, string>;

const PELE = "#e0ac69";
const PELE_ESCURA = "#c98d4b";

export const PALETAS: Record<string, Paleta> = {
  gestor: {
    "1": "#4a3728",
    "2": PELE,
    "3": "#ffb347",
    "4": "#cc8a2e",
    "5": "#1b1f26",
    "6": "#ff5a5a",
  },
  dev: {
    "1": "#2b2b3a",
    "2": PELE,
    "3": "#35f0a0",
    "4": "#22a870",
    "5": "#1b1f26",
    "6": "#ff5a5a",
  },
  revisor: {
    "1": "#5a3d2b",
    "2": PELE_ESCURA,
    "3": "#4fd6ff",
    "4": "#2f93b5",
    "5": "#1b1f26",
    "6": "#ff5a5a",
  },
  funcionario: {
    "1": "#3d3d4d",
    "2": PELE,
    "3": "#b6c2d1",
    "4": "#7d8899",
    "5": "#1b1f26",
    "6": "#ff5a5a",
  },
};

export function paletaDe(sprite: string): Paleta {
  return PALETAS[sprite] ?? PALETAS.funcionario;
}

// ------------------------------------------------------------------ cenário

/** Monitor da mesa. A tela muda de cor conforme o agente trabalha ou não. */
export const MONITOR: Matriz = [
  "..........",
  ".TTTTTTTT.",
  ".TSSSSSST.",
  ".TSSSSSST.",
  ".TSSSSSST.",
  ".TTTTTTTT.",
  "....TT....",
  "..TTTTTT..",
];

export const PLANTA: Matriz = [
  "....VV....",
  "..VVVVVV..",
  ".VVVVVVVV.",
  "..VVVVVV..",
  "....VV....",
  "....VV....",
  "..PPPPPP..",
  "..PPPPPP..",
  "...PPPP...",
];

export const CAFE: Matriz = [
  "..........",
  "...ff.f...",
  "..f.ff....",
  "..CCCCCC..",
  "..CCCCCCC.",
  "..CCCCCC.C",
  "..CCCCCC..",
  "...CCCC...",
];

export const PALETA_CENARIO: Paleta = {
  T: "#2c3440",
  S: "#0f1620",
  V: "#2f8f5b",
  P: "#8a5a3b",
  C: "#c9d4e0",
  f: "#5b6b7d",
};
