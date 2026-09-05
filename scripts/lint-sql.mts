// Barra DDL destrutivo antes que ele chegue no banco.
//
// É a regra 9 da constituição: o CI não aplica migrations, então um
// `drop table` num PR passaria verde e só explodiria quando alguém rodasse
// `db:migrate` — e o plano gratuito do Supabase não tem point-in-time
// recovery, então essa explosão não tem como desfazer. Este linter é a
// última trava antes disso acontecer.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const DIRETORIO_SQL = join(process.cwd(), "supabase");

type Violacao = {
  arquivo: string;
  linha: number;
  trecho: string;
  motivo: string;
};

function listarArquivosSql(diretorio: string): string[] {
  const resultado: string[] = [];
  let entradas;
  try {
    entradas = readdirSync(diretorio, { withFileTypes: true });
  } catch {
    return resultado;
  }
  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarArquivosSql(caminho));
    } else if (entrada.isFile() && entrada.name.endsWith(".sql")) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

// Troca comentários (`--` e `/* */`) e literais de string (aspas simples,
// com `''` como aspas escapada) por espaços, preservando posição e quebras
// de linha. O schema.sql explica regras destrutivas em comentário e monta
// `drop policy if exists` via `format()` dentro de string — sem isso, o
// linter acusaria o próprio texto que explica por que a regra existe.
function sanitizar(conteudo: string): string {
  const saida = new Array<string>(conteudo.length);
  const tam = conteudo.length;
  let i = 0;
  let dentroLinha = false;
  let dentroBloco = false;
  let dentroString = false;

  while (i < tam) {
    const c = conteudo[i];
    const prox = conteudo[i + 1];

    if (dentroLinha) {
      saida[i] = c === "\n" ? "\n" : " ";
      if (c === "\n") dentroLinha = false;
      i++;
      continue;
    }

    if (dentroBloco) {
      if (c === "*" && prox === "/") {
        saida[i] = " ";
        saida[i + 1] = " ";
        i += 2;
        dentroBloco = false;
        continue;
      }
      saida[i] = c === "\n" ? "\n" : " ";
      i++;
      continue;
    }

    if (dentroString) {
      if (c === "'" && prox === "'") {
        // aspas simples duplicada = aspas literal escapada, string continua
        saida[i] = " ";
        saida[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === "'") {
        dentroString = false;
        saida[i] = " ";
        i++;
        continue;
      }
      saida[i] = c === "\n" ? "\n" : " ";
      i++;
      continue;
    }

    if (c === "-" && prox === "-") {
      dentroLinha = true;
      saida[i] = " ";
      i++;
      continue;
    }
    if (c === "/" && prox === "*") {
      dentroBloco = true;
      saida[i] = " ";
      i++;
      continue;
    }
    if (c === "'") {
      dentroString = true;
      saida[i] = " ";
      i++;
      continue;
    }

    saida[i] = c;
    i++;
  }

  return saida.join("");
}

function numeroDaLinha(conteudo: string, offset: number): number {
  let linha = 1;
  for (let i = 0; i < offset; i++) {
    if (conteudo[i] === "\n") linha++;
  }
  return linha;
}

function trechoOriginal(conteudo: string, inicio: number, fim: number): string {
  return conteudo.slice(inicio, fim).replace(/\s+/g, " ").trim();
}

// Só os quatro `drop` mais o `truncate` — `drop policy if exists`,
// `drop index`, `create or replace view` e `alter table ... enable row
// level security` não entram aqui de propósito, são operações reversíveis
// ou puramente declarativas.
const PADROES: { regex: RegExp; motivo: string }[] = [
  {
    regex: /\bdrop\s+table\b/gi,
    motivo: "apaga uma tabela inteira — sem point-in-time recovery, não tem como desfazer",
  },
  {
    regex: /\bdrop\s+column\b/gi,
    motivo: "apaga uma coluna e os dados nela, sem como desfazer",
  },
  {
    regex: /\bdrop\s+database\b/gi,
    motivo: "apaga o banco inteiro",
  },
  {
    regex: /\bdrop\s+schema\b/gi,
    motivo: "apaga um schema inteiro e tudo dentro dele",
  },
  {
    regex: /\btruncate\b/gi,
    motivo: "esvazia a tabela inteira de uma vez, sem como desfazer",
  },
];

function verificarArquivo(caminho: string, base: string): Violacao[] {
  const violacoes: Violacao[] = [];
  const original = readFileSync(caminho, "utf8");
  const sanitizado = sanitizar(original);
  const caminhoRelativo = relative(base, caminho);

  for (const { regex, motivo } of PADROES) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(sanitizado))) {
      violacoes.push({
        arquivo: caminhoRelativo,
        linha: numeroDaLinha(original, m.index),
        trecho: trechoOriginal(original, m.index, m.index + m[0].length),
        motivo,
      });
    }
  }

  // `delete from` só é permitido com `where` na mesma instrução — sem
  // filtro, apaga a tabela inteira, e é indistinguível de um truncate.
  const regexDelete = /\bdelete\s+from\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regexDelete.exec(sanitizado))) {
    const posPontoEVirgula = sanitizado.indexOf(";", m.index);
    const fim = posPontoEVirgula === -1 ? sanitizado.length : posPontoEVirgula;
    const instrucao = sanitizado.slice(m.index, fim);
    if (!/\bwhere\b/i.test(instrucao)) {
      violacoes.push({
        arquivo: caminhoRelativo,
        linha: numeroDaLinha(original, m.index),
        trecho: trechoOriginal(original, m.index, Math.min(fim, m.index + 120)),
        motivo: "delete sem where apaga a tabela inteira, igual um truncate",
      });
    }
  }

  return violacoes;
}

function main(): void {
  const arquivos = listarArquivosSql(DIRETORIO_SQL);
  const todasViolacoes: Violacao[] = [];

  for (const arquivo of arquivos) {
    todasViolacoes.push(...verificarArquivo(arquivo, process.cwd()));
  }

  if (todasViolacoes.length > 0) {
    for (const v of todasViolacoes) {
      console.log(`${v.arquivo}:${v.linha} — "${v.trecho}"`);
      console.log(`  proibido: ${v.motivo}`);
    }
    console.log(`\n${todasViolacoes.length} violação(ões) de DDL destrutivo encontrada(s).`);
    process.exit(1);
  }

  console.log("OK — nenhum DDL destrutivo.");
  process.exit(0);
}

main();
