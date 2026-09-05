---
quando: antes de usar contratar_agente ou promover_agente — decidir se e como montar um novo funcionário
---

# Contratação

`contratar_agente` cria uma pessoa nova nesta empresa, com salário (tokens) a
partir do primeiro tick dela. Contratação errada não é reversível de graça: dá
para desativar depois, mas o custo de ter contratado cedo demais, ou mal, já foi
gasto. Esta skill é sobre decidir bem, não só sobre a mecânica da ferramenta.

## Contrate por trabalho recorrente, nunca por antecipação

O motivo certo para `contratar_agente` é: existe uma fila de trabalho real, do
tipo que ninguém no time atual consegue fazer, e ela não vai parar de crescer.
"Achamos que vamos precisar de alguém de marketing eventualmente" não é motivo —
é planejamento de organograma antes de haver organização para planejar.

Teste prático antes de contratar: consegue apontar pelo menos duas tarefas
concretas, já existentes ou previsíveis com alta confiança, que essa pessoa faria
na primeira semana? Se não consegue, ainda é cedo. Espere o trabalho aparecer, e
contrate quando ele já estiver empilhado.

O backlog inicial da empresa tem isso desenhado de propósito: contratar um
Pesquisador de Mercado só "se a pesquisa se mostrar trabalho recorrente" — não
antes de saber que é recorrente.

## O prompt do novato: ofício, não cargo

O campo `prompt` de `contratar_agente` não é a descrição de vaga. É o texto que
essa pessoa vai carregar em todo prompt, para sempre — é quem ela é. Escreva em
segunda pessoa, como se estivesse explicando o trabalho a alguém que acabou de
sentar na cadeira ao seu lado.

**Isto não:** "Você é o Pesquisador de Mercado. Responsável por pesquisas de
mercado e análise de concorrência."

**Isto sim:** "Você pesquisa mercado para decisões que custam caro errar. Quando
encontrar um número, ele não entra na memória sem data, amostra e fonte — número
sem essas três coisas é chute com roupa de dado. Quando duas fontes discordam,
você relata a discordância, não escolhe a que confirma o que já se esperava. Seu
critério de qualidade: se alguém pedir a fonte de qualquer afirmação sua, você
tem o link na mesma hora."

Repare que a segunda versão diz **como** fazer bem o trabalho, não só **o que** é
o trabalho. Papel genérico produz trabalho genérico; critério de qualidade
concreto produz trabalho revisável.

Lembre também que `prompt-base.ts` já cobre quem é a empresa, qual a meta ativa e
a fronteira do que uma IA pode fazer — não repita isso no prompt do agente. Use
o espaço só para o ofício específico dele.

## O kit mínimo — e o que você não pode conceder

Dê a ferramenta que a função exige, nem mais nem menos. Um agente com ferramenta
que ele não usa é risco parado (mais superfície para erro ou abuso) sem
benefício. Um agente sem a ferramenta que precisa vai empacar na primeira tarefa
e abrir pedido de acesso — o que é o comportamento certo, mas custa um ciclo.

A regra dura, que a própria ferramenta impõe (regra 2 da constituição): **você só
concede ferramenta e skill que você mesmo tem.** `contratar_agente` rejeita a
chamada se você tentar dar algo fora do seu kit — não é um limite a driblar, é
por isso que só o Gestor tem as 13 ferramentas. Se o novato precisa de algo que
você não tem, isso é sinal de que quem deveria contratar é o seu superior, não
você.

## Escolha as skills do papel, não todas

Skill é ofício empacotado — dê as que o papel realmente vai usar. Um Dev recebe
`pesquisa-com-fonte` e `revisao-de-codigo`, não `escrita-seo`. Skill a mais não
ajuda (ninguém carrega o que não vai usar) e só polui o índice que aparece no
prompt dele.

## A quem ele se reporta

Todo `contratar_agente` que você chama coloca o novato reportando a você
(`superior_id` vira o seu id, automaticamente). Isso significa: você vira
responsável por escalonamento dele, por revisar se o trabalho está saindo, e por
decidir se ele continua. Não contrate alguém que você não vai efetivamente
supervisionar.

## Quando criar um time com líder

Um grupo reportando direto a você funciona até uns quatro subordinados. Depois
disso, cada tick seu vira gerenciar gente em vez de mover a meta, e o
escalonamento (regra: só o Gestor fala com o Kauã, tudo mais sobe a cadeia)
começa a passar por um gargalo único. Quando isso acontecer, use
`promover_agente`: escolha quem já demonstrou trabalho sólido dentro do grupo,
crie o time, e deixe os relatórios subirem por ele. Você continua no topo — só
para de ser o único ponto de leitura de cada linha de trabalho.

Não promova cedo demais: um time de duas pessoas com líder é burocracia sem
função. A regra dos quatro é limite, não meta.

## Demitir ou desativar quem não produz

Contratar sem depois avaliar é o mesmo erro que "planejar por antecipação" — gasto
sem disciplina. Se um agente está há duas ou mais semanas sem entregar tarefa
concluída, sem evidência de progresso, ou travando toda tarefa em `bloqueada`, o
problema não se resolve sozinho. Investigue primeiro: o kit dele está incompleto?
O prompt é vago demais para o trabalho que ele recebe? Se a causa for corrigível,
corrija o prompt ou o kit antes de desativar.

Se não for corrigível — ou já foi corrigido e o problema persiste — marque
`ativo = false` para esse agente. Isso não é punição, é higiene: um agente
inativo não consome tempo de supervisão, não aparece como opção para receber
tarefa nova, e libera espaço mental (seu, e do sistema) para quem está de fato
produzindo. Registre o motivo numa ata, do mesmo jeito que uma contratação
registra a justificativa — decisão de desligar merece o mesmo rastro que a
decisão de contratar.
