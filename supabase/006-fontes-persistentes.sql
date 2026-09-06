-- As fontes lidas precisam sobreviver ao fim do tick.
--
-- `ctx.fontesLidas` vivia só em memória, recriado vazio a cada invocação. Como
-- um agente atravessa muitos ticks, isso causava três estragos ao mesmo tempo:
--
--   1. Ele perdia tudo que já tinha pesquisado e buscava de novo — o mesmo
--      trabalho, o mesmo custo, várias vezes.
--   2. A regra 11 recusava a anotação dele no tick seguinte ("você não leu
--      estas fontes"), porque a lista estava vazia. Ele nunca conseguia
--      registrar o que aprendeu.
--   3. A checagem de originalidade comparava contra lista vazia, deixando
--      passar cópia justamente quando havia mais o que copiar.
--
-- O resultado apareceu no banco: quatro tarefas bloqueadas, todas por "estourou
-- o teto de passos sem concluir". Os agentes estavam girando.

alter table execucoes
  add column if not exists fontes jsonb not null default '[]'::jsonb;

comment on column execucoes.fontes is
  'O que este agente já leu nesta tarefa: url e trecho. Sobrevive entre ticks.';
