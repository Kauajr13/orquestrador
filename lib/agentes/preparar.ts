import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agente, Meta, Tarefa } from "@/lib/tipos";
import { CATALOGO } from "./ferramentas";
import { colegasDe } from "./hierarquia";
import { montarPromptBase } from "./prompt-base";
import { listarSkills } from "./skills";

/**
 * Monta o prompt de um agente a partir do estado real da empresa: quem são os
 * colegas hoje, qual a meta de agora, o que ele já aprendeu.
 *
 * É refeito a cada execução de propósito. Um agente contratado ontem precisa
 * aparecer na lista de colegas de todo mundo hoje, sem ninguém reescrever nada.
 */
export async function montarPromptDoAgente(
  supabase: SupabaseClient,
  agente: Agente,
  tarefa: Tarefa | null,
): Promise<string> {
  const [{ superior, colegas }, meta, skills, memoria] = await Promise.all([
    colegasDe(supabase, agente),
    metaAtiva(supabase),
    listarSkills(),
    memoriaRecente(supabase),
  ]);

  const doKit = CATALOGO.filter((f) => agente.ferramentas.includes(f.nome));
  const foraDoKit = CATALOGO.filter((f) => !agente.ferramentas.includes(f.nome));

  return montarPromptBase({
    agente,
    superior,
    colegas,
    meta,
    tarefa,
    ferramentasDisponiveis: doKit.map((f) => ({ nome: f.nome, descricao: f.descricao })),
    ferramentasQueNaoTem: foraDoKit.map((f) => f.nome),
    skillsDisponiveis: skills
      .filter((s) => agente.skills.includes(s.nome))
      .map((s) => ({ nome: s.nome, quando: s.quando })),
    memoria,
  });
}

async function metaAtiva(supabase: SupabaseClient): Promise<Meta | null> {
  const { data } = await supabase.from("metas").select("*").eq("ativa", true).maybeSingle();
  return (data as Meta) ?? null;
}

/**
 * A memória entra inteira no prompt, então tem teto — e o teto é apertado de
 * propósito.
 *
 * O free tier do Groq corta requisição acima de 8000 tokens por minuto, e o
 * prompt já carrega o papel, os colegas, o índice de skills e o schema de 13
 * ferramentas. Sobra pouco para a memória. Quando ela crescer além disso, a
 * empresa vai precisar aprender a resumir a própria memória — e essa é uma boa
 * tarefa para ela mesma resolver.
 */
async function memoriaRecente(
  supabase: SupabaseClient,
): Promise<{ chave: string; conteudo: string }[]> {
  const { data } = await supabase
    .from("memoria")
    .select("chave, conteudo")
    .order("atualizado_em", { ascending: false })
    .limit(6);

  return (data ?? []).map((m) => ({
    chave: m.chave as string,
    conteudo: String(m.conteudo).slice(0, 700),
  }));
}
