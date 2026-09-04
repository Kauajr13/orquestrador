-- Schema da empresa. Roda com `npm run db:migrate`.
--
-- Idempotente de propósito: precisa poder rodar duas vezes seguidas sem erro,
-- porque a Management API não guarda histórico de migration e a única garantia
-- de que o banco está no estado certo é reaplicar o arquivo inteiro.
--
-- Status são `text` com check, não enum. Enum no Postgres é DDL chato de evoluir
-- (ALTER TYPE não roda dentro de transação em versões antigas), e aqui os status
-- vão mudar conforme a empresa aprende a trabalhar.

-- ---------------------------------------------------------------- times

create table if not exists times (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  lider_id   uuid,                        -- FK adicionada depois: referência circular com agentes
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------- agentes

create table if not exists agentes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  papel        text not null,             -- gestor, dev, revisor, e o que o Gestor inventar
  prompt       text not null,             -- a personalidade e o ofício deste funcionário
  superior_id  uuid references agentes(id) on delete set null,
  time_id      uuid references times(id) on delete set null,
  status       text not null default 'idle'
               check (status in ('idle','working','done','error','descansando')),
  ferramentas  text[] not null default '{}',
  skills       text[] not null default '{}',
  sprite       text not null default 'funcionario',
  modelo       text,                      -- null = usa o roteamento padrão por tipo de tarefa
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  contratado_por uuid references agentes(id) on delete set null
);

-- A FK de líder só pode existir depois de agentes. Postgres não tem
-- "add constraint if not exists", daí o bloco.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'times_lider_id_fkey') then
    alter table times
      add constraint times_lider_id_fkey
      foreign key (lider_id) references agentes(id) on delete set null;
  end if;
end $$;

-- Histórico de prompt e kit. Um agente pode ter o próprio prompt reescrito pelo
-- Gestor; sem isso, um funcionário que derivou não teria como voltar ao que era.
create table if not exists agentes_historico (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid not null references agentes(id) on delete cascade,
  prompt      text not null,
  ferramentas text[] not null default '{}',
  skills      text[] not null default '{}',
  motivo      text,
  criado_em   timestamptz not null default now()
);

create index if not exists agentes_historico_agente_idx
  on agentes_historico (agente_id, criado_em desc);

-- ---------------------------------------------------------------- tarefas

create table if not exists tarefas (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text not null default '',
  status         text not null default 'pendente'
                 check (status in ('pendente','em_andamento','em_revisao',
                                   'mudancas_pedidas','aprovada','concluida',
                                   'falhou','bloqueada')),
  agente_id      uuid references agentes(id) on delete set null,
  atribuida_por  uuid references agentes(id) on delete set null,
  escalada_para  uuid references agentes(id) on delete set null,
  -- 'local' é o gancho pro OpenClaw da fase 2: quando o PC do Kauã estiver
  -- ligado, ele puxa as tarefas pesadas de código e roda na assinatura dele.
  executor       text not null default 'nuvem' check (executor in ('nuvem','local')),
  prioridade     int  not null default 5,
  pr_numero      int,
  pr_url         text,
  branch         text,
  parecer        text,                    -- o que o Revisor achou
  resultado      text,
  tentativas     int  not null default 0,
  passos         int  not null default 0, -- teto por tarefa: agente confuso não queima o dia
  -- Lock otimista. Dois ticks simultâneos vão acontecer (o Actions atrasa e
  -- sobrepõe); sem isso, dois runners pegam a mesma tarefa e abrem PRs iguais.
  -- O lease também devolve pra fila a tarefa cujo tick morreu no timeout de 60s.
  lock_ate       timestamptz,
  criado_em      timestamptz not null default now(),
  iniciado_em    timestamptz,
  concluido_em   timestamptz
);

create index if not exists tarefas_fila_idx
  on tarefas (status, prioridade desc, criado_em);
create index if not exists tarefas_agente_idx
  on tarefas (agente_id, status);

-- ---------------------------------------------------------------- execuções

-- Uma execução é o raciocínio de um agente sobre uma tarefa, atravessando
-- vários ticks. `conversa` guarda o histórico de mensagens e tool calls: é o
-- que permite retomar em vez de recomeçar quando a função da Vercel morre.
create table if not exists execucoes (
  id              uuid primary key default gen_random_uuid(),
  agente_id       uuid not null references agentes(id) on delete cascade,
  tarefa_id       uuid references tarefas(id) on delete cascade,
  conversa        jsonb not null default '[]'::jsonb,
  encerrada       boolean not null default false,
  modelo          text,
  tokens_entrada  bigint not null default 0,
  tokens_saida    bigint not null default 0,
  -- Custo a preço de mercado, calculado mesmo enquanto o b.ai é gratuito.
  -- É como o Kauã vê a conta chegando antes de ela chegar.
  custo_estimado  numeric(12,6) not null default 0,
  duracao_ms      bigint not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index if not exists execucoes_agente_idx on execucoes (agente_id, criado_em desc);
create index if not exists execucoes_tarefa_idx on execucoes (tarefa_id);
create index if not exists execucoes_abertas_idx on execucoes (encerrada, atualizado_em);

-- ---------------------------------------------------------------- logs

create table if not exists logs (
  id         uuid primary key default gen_random_uuid(),
  agente_id  uuid references agentes(id) on delete cascade,
  tarefa_id  uuid references tarefas(id) on delete set null,
  nivel      text not null default 'info' check (nivel in ('info','warn','erro','sucesso')),
  mensagem   text not null,
  criado_em  timestamptz not null default now()
);

create index if not exists logs_recentes_idx on logs (criado_em desc);

-- ---------------------------------------------------------------- memória

-- O que a empresa aprendeu. Sempre com fonte: uma conclusão sem origem é chute,
-- e chute vira decisão errada três semanas depois.
create table if not exists memoria (
  id         uuid primary key default gen_random_uuid(),
  chave      text not null unique,
  conteudo   text not null,
  fontes     text[] not null default '{}',
  agente_id  uuid references agentes(id) on delete set null,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- metas

create table if not exists metas (
  id         uuid primary key default gen_random_uuid(),
  ordem      int  not null,
  titulo     text not null,
  descricao  text not null default '',
  alvo       text not null,               -- como se sabe que foi atingida
  ativa      boolean not null default false,
  atingida   boolean not null default false,
  evidencia  text,
  criado_em  timestamptz not null default now(),
  atingida_em timestamptz
);

-- Retrospectiva semanal. Sem evidência declarada, o sistema para e replaneja —
-- é o antídoto ao teatro de produtividade, que é o jeito mais provável de esta
-- empresa falhar (bem antes de qualquer problema de segurança).
create table if not exists retrospectivas (
  id          uuid primary key default gen_random_uuid(),
  meta_id     uuid references metas(id) on delete set null,
  semana      date not null unique,
  evidencia   text,
  houve_progresso boolean not null default false,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------- site

create table if not exists paginas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titulo      text not null,
  resumo      text not null default '',
  conteudo    text not null,
  fontes      text[] not null default '{}',
  publicada   boolean not null default false,
  agente_id   uuid references agentes(id) on delete set null,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists paginas_publicadas_idx on paginas (publicada, atualizado_em desc);

-- ---------------------------------------------------------------- narrativa

-- Uma frase por dia, em primeira pessoa. É o que faz a empresa parecer viva e
-- dá material pro build in public.
create table if not exists diario (
  id         uuid primary key default gen_random_uuid(),
  agente_id  uuid not null references agentes(id) on delete cascade,
  dia        date not null default current_date,
  texto      text not null,
  criado_em  timestamptz not null default now(),
  unique (agente_id, dia)
);

-- Decisões com justificativa. O log diz o que aconteceu; a ata diz por quê.
create table if not exists atas (
  id           uuid primary key default gen_random_uuid(),
  agente_id    uuid references agentes(id) on delete set null,
  decisao      text not null,
  justificativa text not null,
  criado_em    timestamptz not null default now()
);

-- ---------------------------------------------------------------- caixa

-- A empresa não gasta o que não ganhou. Enquanto o saldo for zero, o runner
-- recusa qualquer ferramenta que custe dinheiro.
create table if not exists caixa (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('receita','despesa')),
  valor      numeric(12,2) not null check (valor > 0),
  descricao  text not null,
  agente_id  uuid references agentes(id) on delete set null,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------- LGPD

create table if not exists consentimentos (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip          inet,
  texto_versao text not null,             -- qual versão dos termos a pessoa aceitou
  aceito_em   timestamptz not null default now(),
  removido_em timestamptz
);

create index if not exists consentimentos_email_idx on consentimentos (email);

-- ---------------------------------------------------------------- notificações

-- Fila do Telegram. Mensagem gerada às 3h fica represada e sai às 8h — o Kauã
-- pediu para ser chamado em horário comercial. Só falha de credencial fura o
-- silêncio, porque com ela o escritório inteiro para.
create table if not exists notificacoes (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null,
  urgencia   text not null default 'normal' check (urgencia in ('normal','critica')),
  tarefa_id  uuid references tarefas(id) on delete set null,
  enviada_em timestamptz,
  criado_em  timestamptz not null default now()
);

create index if not exists notificacoes_pendentes_idx on notificacoes (enviada_em, criado_em);

-- ---------------------------------------------------------------- config

create table if not exists config (
  chave      text primary key,
  valor      text not null,
  atualizado_em timestamptz not null default now()
);

insert into config (chave, valor) values
  ('pausado',            'false'),
  ('expediente_inicio',  '8'),
  ('expediente_fim',     '18'),
  ('teto_tarefas_dia',   '20'),
  ('teto_tokens_dia',    '5000000'),
  ('teto_passos_tarefa', '25'),
  ('fuso',               'America/Sao_Paulo')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------- folha

-- Salário = o que o funcionário gastou de token no mês. A ideia é do Kauã, e
-- funciona: dá uma noção imediata de quem é caro e quem é barato.
create or replace view salarios as
select
  a.id                                   as agente_id,
  a.nome,
  a.papel,
  date_trunc('month', e.criado_em)::date as mes,
  sum(e.tokens_entrada + e.tokens_saida) as tokens,
  sum(e.custo_estimado)                  as custo
from agentes a
join execucoes e on e.agente_id = a.id
group by a.id, a.nome, a.papel, date_trunc('month', e.criado_em);

-- ---------------------------------------------------------------- RLS
--
-- Leitura só para autenticado; escrita nenhuma pelo cliente. Todo write passa
-- pela service_role no servidor, que ignora RLS por natureza.
--
-- Exceção pública: páginas publicadas e o diário — são o site e a vitrine do
-- build in public.

do $$
declare
  t text;
begin
  foreach t in array array[
    'times','agentes','agentes_historico','tarefas','execucoes','logs','memoria',
    'metas','retrospectivas','paginas','diario','atas','caixa','consentimentos',
    'notificacoes','config'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'leitura_autenticada_' || t, t);
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      'leitura_autenticada_' || t, t
    );
  end loop;
end $$;

drop policy if exists paginas_publicas on paginas;
create policy paginas_publicas on paginas
  for select to anon using (publicada = true);

drop policy if exists diario_publico on diario;
create policy diario_publico on diario
  for select to anon using (true);

-- Realtime: o terminal ao vivo assina `logs`, e o escritório assina `agentes`
-- e `tarefas` pra trocar a animação sem recarregar a página.
do $$
declare
  t text;
begin
  foreach t in array array['logs','agentes','tarefas'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
