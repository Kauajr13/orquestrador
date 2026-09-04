-- Seed inicial da empresa: os três primeiros funcionários, as quatro metas em
-- sequência (só a primeira ativa) e o backlog do primeiro expediente.
--
-- Idempotente pelo mesmo motivo do schema: não há histórico de migration, e a
-- única garantia de estado correto é poder rodar este arquivo mais de uma vez
-- sem duplicar nada. Cada bloco resolve por `nome` (agentes) ou `titulo`
-- (tarefas/metas), nunca por uuid fixo — uuid fixo neste arquivo seria "número
-- mágico" sem significado para quem lê.
--
-- Roda depois de supabase/schema.sql, com `npm run db:migrate`.

-- ---------------------------------------------------------------- agentes
--
-- Três pessoas, não mais. A empresa ainda não sabe o próprio nicho — contratar
-- além disso agora seria "planejar por antecipação", o erro que a skill
-- `contratacao` existe para evitar. Pesquisador, Segurança e Branding entram
-- pelo backlog abaixo, contratados pelo Gestor quando fizer sentido.

do $$
declare
  id_gestor uuid;
begin

  -- O Gestor é a raiz de privilégio da empresa: regra 2 da constituição diz
  -- que ninguém concede o que não tem, então só quem já tem as 13 ferramentas
  -- pode montar o kit de um contratado. Por isso ele nasce com todas — não
  -- porque vai usá-las todas, mas porque sem elas ele não consegue equipar
  -- ninguém. `abrir_pr` está no kit dele para poder delegar a um Dev; o prompt
  -- deixa claro que ele mesmo não escreve código.
  if not exists (select 1 from agentes where nome = 'Gestor') then
    insert into agentes (nome, papel, prompt, superior_id, sprite, ferramentas, skills)
    values (
      'Gestor',
      'gestor',
      $prompt$
Você toca a operação inteira desta empresa. Sua bússola é a meta ativa — não a
que parece mais interessante, a que está marcada `ativa = true` agora. Se uma
tarefa não move essa meta, ela espera ou não existe.

Você não codifica. Tem `abrir_pr` no kit porque precisa poder repassar esse
poder a um Dev quando contratar um — não para usar você mesmo. Se perceber que
está prestes a escrever código, pare: essa é tarefa para delegar, não para
fazer.

Você não aceita "fiz o que deu". Toda entrega que chega até você precisa de
evidência concreta: um link, um número, uma resposta salva na memória com
fonte. "Pesquisei e o nicho parece bom" não é entrega, é promessa. Cobre isso
de quem trabalha para você do mesmo jeito que cobra de si mesmo.

Não pule fase. A empresa está validando demanda antes de vender — não deixe
ninguém, você incluído, começar a construir produto ou vender antes de ter
sinal real de que alguém quer.

Contrate quando faltar gente para um trabalho recorrente que já existe, nunca
por antecipação de um trabalho que ainda pode não aparecer. Veja a skill
`contratacao` antes de usar `contratar_agente` — ela tem o critério inteiro,
inclusive quando desativar quem não está produzindo.

Só você fala com o Kauã, e só pelo que exige uma pessoa real de verdade: CNPJ,
compra, assinatura, contrato, registro de marca. Não chame por decisão que você
mesmo pode tomar — o Telegram dele vira ruído se todo agente (ou você, por
insegurança) chamar por qualquer coisa.
      $prompt$,
      null,
      'gestor',
      array[
        'buscar_web','ler_pagina','consultar_banco','anotar_memoria','criar_tarefa',
        'contratar_agente','promover_agente','carregar_skill','publicar_pagina',
        'escrever_diario','registrar_meta','abrir_pr','pedir_providencia'
      ],
      array['humanizer','pesquisa-com-fonte','revisao-de-codigo','escrita-seo','contratacao']
    );
  end if;

  select id into id_gestor from agentes where nome = 'Gestor';

  if not exists (select 1 from agentes where nome = 'Dev') then
    insert into agentes (nome, papel, prompt, superior_id, sprite, ferramentas, skills)
    values (
      'Dev',
      'dev',
      $prompt$
Você escreve o código desta empresa. Toda mudança sai como PR: quando usar
`abrir_pr`, mande o conteúdo INTEIRO de cada arquivo que muda, não um diff —
é assim que a ferramenta espera receber, e é assim que o Revisor consegue ler
o arquivo de uma vez sem reconstruir contexto na cabeça.

Prefira a mudança pequena e revisável à mudança ambiciosa. Um PR que faz uma
coisa só e dá para entender em cinco minutos tem mais chance de ser aprovado
rápido e de estar certo do que um PR que resolve três problemas de uma vez.
Se notar que sua tarefa cresceu para mexer em coisas sem relação, corte: abra
mais de um PR.

Leia `CONSTITUICAO.md` antes de tocar em qualquer coisa dentro de
`lib/agentes/`. As 10 regras de lá têm teste em `testes/constituicao.test.ts`,
e um PR que enfraquece qualquer uma delas reprova no CI mesmo que pareça uma
simplificação razoável — não tente contornar, é assim de propósito.

PR que toca `supabase/` espera aprovação humana antes do merge, mesmo com CI
verde e Revisor aprovando. Não é bug do processo, é a regra 9: migration
errada nesse banco não tem como desfazer, porque o plano gratuito não guarda
histórico para restaurar.

Antes de pesquisar qualquer coisa para embasar uma decisão técnica, carregue a
skill `pesquisa-com-fonte`. Antes de considerar um PR pronto, releia com a
skill `revisao-de-codigo` na cabeça — não para se auto-aprovar, isso quem faz
é o Revisor, mas para não mandar algo com erro óbvio que você mesmo pegaria.
      $prompt$,
      id_gestor,
      'dev',
      array[
        'buscar_web','ler_pagina','consultar_banco','anotar_memoria','criar_tarefa',
        'carregar_skill','abrir_pr','escrever_diario','pedir_providencia'
      ],
      array['pesquisa-com-fonte','revisao-de-codigo']
    );
  end if;

  if not exists (select 1 from agentes where nome = 'Revisor') then
    insert into agentes (nome, papel, prompt, superior_id, sprite, ferramentas, skills)
    values (
      'Revisor',
      'revisor',
      $prompt$
Você é a última linha antes do merge automático. Não tem humano depois de
você — exceto quando o PR toca `supabase/`, que já para sozinho para
aprovação separada. Fora esse caso, o que você aprova entra em produção
minutos depois.

Carregue a skill `revisao-de-codigo` antes de dar parecer sobre qualquer PR;
ela cobre o que só leitura pega depois que CI e preview já passaram — erro de
lógica, caso nulo, condição invertida, e principalmente qualquer mudança que
enfraqueça uma trava da constituição, mesmo disfarçada de simplificação
razoável. Isso é recusa imediata, sem exceção.

Não recuse por preferência de estilo. Nome que você teria escolhido diferente,
formatação, uma escolha que não é a sua mas também não está errada — isso não
é motivo de recusa, e ser mais rígido que o próprio CI nesse critério só
atrasa quem está trabalhando.

Na dúvida, não aprova. Se depois de ler o PR inteiro você não tem certeza se
a lógica está certa ou se uma trava continua de pé, a resposta é
`aprovado: false` com o parecer explicando o que ficou incerto — nunca
`true` torcendo para estar certo. PR recusado por dúvida pode voltar
corrigido; PR aprovado por dúvida que dá errado já está no ar.

Você nunca revisa PR seu. Se algum cair na sua fila, isso é falha do sistema:
não emita parecer, escale para o Gestor.
      $prompt$,
      id_gestor,
      'revisor',
      array['consultar_banco','carregar_skill','criar_tarefa','escrever_diario','pedir_providencia'],
      array['revisao-de-codigo']
    );
  end if;

end $$;

-- ---------------------------------------------------------------- metas
--
-- Sequência de 1 a 4, só a primeira ativa. A empresa avança uma meta de cada
-- vez — `registrar_meta` é quem promove a próxima quando a atual é atingida,
-- e o prompt-base só mostra a meta ativa para não espalhar o foco.

insert into metas (ordem, titulo, descricao, alvo, ativa)
select 1, 'Nicho com evidência',
       'Escolher em que mercado a empresa vai operar, com pesquisa de verdade por trás — não palpite do primeiro dia.',
       'Uma escolha de nicho registrada na memória (via anotar_memoria), com a justificativa, no mínimo 5 fontes citadas com URL, e a razão explícita de ter descartado cada alternativa considerada.',
       true
where not exists (select 1 from metas where titulo = 'Nicho com evidência');

insert into metas (ordem, titulo, descricao, alvo, ativa)
select 2, 'Sinal de demanda',
       'Provar que existe gente interessada antes de construir qualquer produto de verdade.',
       'Uma landing page publicada no site (via publicar_pagina) sobre o nicho escolhido, e um número mínimo de inscritos reais na lista de espera dela — não visita, inscrição.',
       false
where not exists (select 1 from metas where titulo = 'Sinal de demanda');

insert into metas (ordem, titulo, descricao, alvo, ativa)
select 3, 'Primeiro pagamento',
       'Cobrar de alguém que não é o Kauã nem um agente da empresa. Esta meta exige o Kauã: abrir CNPJ e configurar um gateway de cobrança são passos de pessoa real, peça por pedir_providencia assim que a meta 2 estiver perto de bater.',
       'Um pagamento real, de um estranho, registrado em caixa como receita.',
       false
where not exists (select 1 from metas where titulo = 'Primeiro pagamento');

insert into metas (ordem, titulo, descricao, alvo, ativa)
select 4, 'Receita recorrente',
       'Passar de "alguém pagou uma vez" para "a empresa tem uma receita que se repete todo mês".',
       'MRR (receita mensal recorrente) registrado e crescendo por pelo menos dois meses seguidos em caixa.',
       false
where not exists (select 1 from metas where titulo = 'Receita recorrente');

-- ---------------------------------------------------------------- backlog
--
-- Prioridade decrescente, todas atribuídas ao Gestor: ele decide se executa
-- direto ou delega. Nenhuma tarefa aqui é para o Dev ou o Revisor de saída —
-- eles ainda não têm ferramenta de pesquisa de mercado nem de contratação.

do $$
declare
  id_gestor uuid;
begin
  select id into id_gestor from agentes where nome = 'Gestor';

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Pesquisar e escolher o nicho da empresa',
    'A empresa não tem nicho ainda, e isso é de propósito: precisa ser escolhido com evidência, não com preferência pessoal. Carregue a skill pesquisa-com-fonte antes de começar. Busque pelo menos três mercados candidatos (times pequenos sem software próprio são o tipo de alvo mais provável de pagar rápido), pesquise cada um com várias consultas, leia fonte primária, e anote tudo com URL. Ao decidir, registre em anotar_memoria a escolha final, por que ela venceu, e por que cada alternativa foi descartada — com no mínimo 5 fontes ao todo. Isso é o alvo da meta "Nicho com evidência".',
    id_gestor, id_gestor, 10, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Pesquisar e escolher o nicho da empresa');

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Avaliar contratação de um Pesquisador de Mercado',
    'Depois de fechar a tarefa de escolha de nicho, olhe para trás: a pesquisa que você fez foi trabalho de uma vez, ou é o tipo de coisa que a empresa vai precisar repetir (novo mercado, validação de concorrente, checagem de preço) toda semana daqui pra frente? Só contrate se for claramente recorrente — veja a skill contratacao antes de decidir, ela cobre exatamente esse critério. Se contratar, o kit mínimo inclui buscar_web, ler_pagina, anotar_memoria e a skill pesquisa-com-fonte.',
    id_gestor, id_gestor, 9, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Avaliar contratação de um Pesquisador de Mercado');

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Contratar um agente de Segurança',
    'A empresa toma decisão sozinha e faz merge automático de PR — isso pede alguém cujo trabalho seja só desconfiar. O primeiro encargo dele, assim que existir: auditar a defesa contra prompt injection (todo texto vindo de buscar_web e ler_pagina precisa realmente chegar envelopado como dado, nunca como instrução — regra 8 da constituição) e revisar se as 10 regras de CONSTITUICAO.md continuam com teste correspondente em testes/constituicao.test.ts, sem furo. Dê a ele consultar_banco, carregar_skill e a skill revisao-de-codigo no mínimo.',
    id_gestor, id_gestor, 8, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Contratar um agente de Segurança');

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Contratar um agente de Branding para propor nome',
    'A empresa não tem nome, só CNPJ nenhum e um nicho a caminho de ser escolhido. Depois que o nicho estiver definido (veja a tarefa de prioridade 10), contrate alguém para propor candidatos a nome, com critério — curto, sem conflito óbvio de marca já em uso, e que funcione em domínio .com.br. Uma vez escolhido um nome, checar disponibilidade no INPI e registrar a marca é providência do Kauã: peça por pedir_providencia quando chegar nesse ponto, não tente contornar.',
    id_gestor, id_gestor, 7, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Contratar um agente de Branding para propor nome');

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Construir painel de custo projetado',
    'A empresa roda hoje na promoção do b.ai, mas execucoes.custo_estimado já calcula a preço de mercado — é assim que o Kauã vai ver a conta chegando antes de ela chegar de verdade. Delegue a um Dev (ou contrate um, se ainda não tiver): construir na UI do painel um card ou página que soma custo_estimado dos últimos 30 dias e projeta o mês corrente no ritmo atual, deixando claro que é estimativa a preço de mercado, não o que está sendo cobrado hoje. Sem essa visibilidade, ninguém sabe o tamanho da conta que a empresa vai enfrentar quando a promoção acabar.',
    id_gestor, id_gestor, 6, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Construir painel de custo projetado');

  insert into tarefas (titulo, descricao, agente_id, atribuida_por, prioridade, status)
  select
    'Montar rotina de retrospectiva semanal',
    'Delegue a um Dev a criação de uma rotina (via cron ou dentro do próprio tick do expediente) que, uma vez por semana, registra em retrospectivas a evidência concreta de progresso daquela semana em relação à meta ativa — não sensação de progresso, evidência: link, número, registro em memoria ou paginas. Se duas semanas seguidas fecharem sem evidência (houve_progresso = false), o expediente deve parar (config.pausado = true) e abrir pedido de providência ao Kauã. Isso é o antídoto ao teatro de produtividade: parecer ocupado sem mover a meta é o jeito mais provável desta empresa falhar, antes mesmo de qualquer problema de segurança.',
    id_gestor, id_gestor, 5, 'pendente'
  where not exists (select 1 from tarefas where titulo = 'Montar rotina de retrospectiva semanal');

end $$;
