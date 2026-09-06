-- O segundo despertador, dentro do próprio banco.
--
-- O GitHub Actions é agendado para 15 em 15 minutos, mas na prática atrasa
-- muito: medindo os disparos reais, deu 20h50, 22h19, 00h08 e 04h40. O GitHub
-- não promete pontualidade em agendamento, e em repositório privado de conta
-- gratuita a fila é pior. Sozinho, ele entrega uma fração dos ticks esperados.
--
-- O pg_cron roda no Postgres do Supabase e dispara na hora. Os dois convivem
-- sem problema: se ambos chamarem junto, o lock otimista da fila garante que só
-- um agente pega a tarefa, e o outro volta sem fazer nada.
--
-- Rodar: npm run db:migrate supabase/003-despertador.sql
-- Depois, preencher interno.segredos com url_producao e cron_secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schema próprio, e não `public`, porque o Supabase expõe o public inteiro pela
-- API. Aqui mora o segredo do cron: fora do alcance de qualquer chave de
-- cliente, e legível pelo Postgres, que é quem precisa.
--
-- A primeira versão disto usava uma tabela em public com RLS e nenhuma policy.
-- Parecia mais seguro e era pior: o próprio job do pg_cron não conseguia ler, a
-- URL vinha nula e o despertador falhava calado.
create schema if not exists interno;

create table if not exists interno.segredos (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);

-- Recria os agendamentos de forma idempotente: rodar este arquivo duas vezes
-- não deixa job duplicado.
do $$
begin
  perform cron.unschedule('expediente');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('resumo-diario');
exception when others then
  null;
end $$;

select cron.schedule(
  'expediente',
  '*/15 * * * *',
  $job$
  select net.http_get(
    url := (select valor from interno.segredos where chave = 'url_producao') || '/api/cron/expediente',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select valor from interno.segredos where chave = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $job$
);

-- 21h30 UTC é 18h30 em Brasília, logo depois de o expediente fechar.
select cron.schedule(
  'resumo-diario',
  '30 21 * * *',
  $job$
  select net.http_get(
    url := (select valor from interno.segredos where chave = 'url_producao') || '/api/cron/resumo',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select valor from interno.segredos where chave = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $job$
);
