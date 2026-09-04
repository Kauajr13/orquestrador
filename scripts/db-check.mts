// Confere que o banco tem exatamente as tabelas que a empresa espera.
//
// Existe porque a Management API não guarda histórico de migration: a única
// forma de saber se supabase/schema.sql foi aplicado de verdade é perguntar
// ao banco o que ele tem hoje, não confiar que um `db:migrate` anterior deu
// certo.

import { resolve as _resolve } from "node:path";

const TABELAS_ESPERADAS = [
  "times",
  "agentes",
  "agentes_historico",
  "tarefas",
  "execucoes",
  "logs",
  "memoria",
  "metas",
  "retrospectivas",
  "paginas",
  "diario",
  "atas",
  "caixa",
  "consentimentos",
  "notificacoes",
  "config",
];

const tokenAcesso = process.env.SUPABASE_ACCESS_TOKEN;
const urlProjeto = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!tokenAcesso || !urlProjeto) {
  console.error("Faltam variáveis de ambiente para checar o banco.\n");
  if (!tokenAcesso) {
    console.error(
      "  SUPABASE_ACCESS_TOKEN não definido — gere um token pessoal em " +
        "https://supabase.com/dashboard/account/tokens e adicione em .env.local"
    );
  }
  if (!urlProjeto) {
    console.error(
      "  NEXT_PUBLIC_SUPABASE_URL não definido — copie a URL do projeto em " +
        "Project Settings > API no dashboard do Supabase e adicione em .env.local"
    );
  }
  process.exit(1);
}

function extrairRef(url: string): string {
  const host = new URL(url).hostname; // <ref>.supabase.co
  return host.split(".")[0];
}

const ref = extrairRef(urlProjeto);
const consulta =
  "select table_name from information_schema.tables where table_schema='public' order by table_name";

const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokenAcesso}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: consulta }),
});

if (!resposta.ok) {
  const corpo = await resposta.text();
  console.error(`Falha ao consultar o banco — status ${resposta.status}`);
  console.error(corpo);
  process.exit(1);
}

const linhas = (await resposta.json()) as Array<Record<string, unknown>>;
const tabelasNoBanco = new Set(linhas.map((linha) => String(linha.table_name)));

let faltando = 0;
for (const tabela of TABELAS_ESPERADAS) {
  if (tabelasNoBanco.has(tabela)) {
    console.log(`${tabela}: ok`);
  } else {
    console.log(`${tabela}: FALTA`);
    faltando++;
  }
}

const total = TABELAS_ESPERADAS.length;
console.log(`\n${total - faltando}/${total} tabelas presentes.`);

if (faltando > 0) {
  process.exit(1);
}
