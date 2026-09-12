// Botão de emergência manual, criado durante o incidente de 07/09/2026 em
// que uma tarefa (`pausarExpediente`) travava o expediente inteiro em loop de
// 40 passos — antes de o bug de retentativa em `falharOuEscalar` (PR #33) ser
// encontrado e corrigido.
//
// É de uso pontual, não automático: reseta TODO agente em 'error'/'working'
// para 'idle' e libera TODO lock preso, mesmo o de quem está trabalhando de
// verdade agora. Rodar com o expediente pausado (`config.pausado = true`),
// nunca com ele ligado.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Faltam variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function destravar() {
  console.log("Iniciando destravamento do orquestrador...");

  // 1. Reseta o status de todos os agentes para 'idle'
  const { error: errAgentes } = await supabase
    .from("agentes")
    .update({ status: "idle" })
    .in("status", ["error", "working"]);

  if (errAgentes) {
    console.error("Erro ao resetar agentes:", errAgentes);
  } else {
    console.log("✅ Agentes resetados com sucesso para 'idle'.");
  }

  // 2. Marca as tarefas presas no loop de 40 passos (pausarExpediente) como falhou
  const { error: errTarefas, data: tarefasAfetadas } = await supabase
    .from("tarefas")
    .update({
      status: "falhou",
      resultado: "Cancelada: arquivo lib/rotinas/pausar_expediente.ts não existia no repositório GitHub, causando estouro de 40 passos.",
    })
    .like("titulo", "%pausarExpediente%")
    .in("status", ["pendente", "em_andamento", "bloqueada"])
    .select("id, titulo");

  if (errTarefas) {
    console.error("Erro ao cancelar tarefas em loop:", errTarefas);
  } else {
    console.log(`✅ ${tarefasAfetadas?.length ?? 0} tarefa(s) em loop cancelada(s):`);
    for (const t of tarefasAfetadas ?? []) {
      console.log(`   - [${t.id}] ${t.titulo}`);
    }
  }

  // 3. Libera qualquer lock preso
  const { error: errLock } = await supabase
    .from("tarefas")
    .update({ lock_ate: null })
    .not("lock_ate", "is", null);

  if (errLock) {
    console.error("Erro ao liberar locks:", errLock);
  } else {
    console.log("✅ Locks expirados/presos liberados.");
  }

  console.log("\nOrquestrador pronto para o próximo tick limpo!");
}

destravar().catch(console.error);
