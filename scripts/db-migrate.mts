// Aplica um arquivo .sql no Supabase via Management API.
//
// A API REST/PostgREST do Supabase só fala com dados (select/insert/update/
// delete) — DDL (create table, alter table, etc.) não passa por ela. A
// Management API é o único jeito de rodar SQL arbitrário, e por isso pede um
// token pessoal em vez da service_role do projeto.
//
// Uso: npm run db:migrate [caminho/do/arquivo.sql]
// Sem argumento, aplica supabase/schema.sql.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokenAcesso = process.env.SUPABASE_ACCESS_TOKEN;
const urlProjeto = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!tokenAcesso || !urlProjeto) {
  console.error("Faltam variáveis de ambiente para aplicar a migration.\n");
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

// A URL do projeto é https://<ref>.supabase.co — o "ref" é o primeiro
// segmento do hostname, e é o identificador que a Management API espera.
function extrairRef(url: string): string {
  const host = new URL(url).hostname;
  return host.split(".")[0];
}

const ref = extrairRef(urlProjeto);
const caminhoArquivo = resolve(process.cwd(), process.argv[2] ?? "supabase/schema.sql");
const sql = readFileSync(caminhoArquivo, "utf8");

const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokenAcesso}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

if (!resposta.ok) {
  const corpo = await resposta.text();
  console.error(`Falha ao aplicar migration — status ${resposta.status}`);
  console.error(corpo);
  process.exit(1);
}

console.log("OK — schema aplicado.");
