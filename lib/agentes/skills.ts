import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Skill é ofício empacotado: um markdown que ensina a fazer bem uma coisa
 * específica, separado da personalidade do agente.
 *
 * Ficam no repositório, e não no banco, por um motivo: assim passam pelo
 * Revisor e pelo CI como qualquer código. Uma skill ruim é corrigida por PR,
 * igual a um bug — e não editada em silêncio direto na produção.
 *
 * No prompt entra só o índice (nome + uma linha). O conteúdo inteiro só é
 * carregado quando o agente decide que vai usar, o que mantém o custo por turno
 * baixo mesmo com dezenas de skills.
 */

export type Skill = { nome: string; quando: string; conteudo: string };

function pastaDeSkills(): string {
  return path.join(process.cwd(), "skills");
}

/** Frontmatter mínimo: `quando:` numa linha. Sem dependência de parser YAML. */
function separarFrontmatter(bruto: string): { quando: string; corpo: string } {
  const casou = bruto.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!casou) return { quando: "", corpo: bruto.trim() };

  const linha = casou[1].split("\n").find((l) => l.trim().startsWith("quando:"));
  const quando = linha ? linha.replace(/^\s*quando:\s*/, "").trim() : "";

  return { quando, corpo: bruto.slice(casou[0].length).trim() };
}

export async function listarSkills(): Promise<Skill[]> {
  let pastas: string[];
  try {
    pastas = await fs.readdir(pastaDeSkills());
  } catch {
    return []; // ainda não há skills; a empresa começa sem e escreve as suas
  }

  const skills: Skill[] = [];
  for (const nome of pastas) {
    const skill = await lerSkill(nome).catch(() => null);
    if (skill) skills.push(skill);
  }
  return skills.sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function lerSkill(nome: string): Promise<Skill> {
  // Nome vem de um modelo: nada de "../" passeando pelo disco.
  const limpo = nome.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(limpo)) {
    throw new Error(`nome de skill inválido: ${nome}`);
  }

  const arquivo = path.join(pastaDeSkills(), limpo, "SKILL.md");
  const bruto = await fs.readFile(arquivo, "utf8");
  const { quando, corpo } = separarFrontmatter(bruto);

  return { nome: limpo, quando, conteudo: corpo };
}
