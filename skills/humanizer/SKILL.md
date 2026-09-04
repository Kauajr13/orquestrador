---
quando: antes de publicar qualquer texto — publicar_pagina recusa conteúdo que não passou por aqui
---

# Humanizer

Isto não é sugestão de estilo. É trava: `publicar_pagina` verifica se você carregou
esta skill antes de aceitar o texto. Então não é "escreva bonito se der tempo" — é
"reescreva até parar de soar como um modelo de linguagem tentando parecer confiante
sobre um assunto que não conhece".

O problema não é usar IA para escrever. É publicar o primeiro rascunho, que tem
tiques reconhecíveis a um parágrafo de distância. Um leitor humano nota antes de
terminar de ler, e o texto perde credibilidade — mesmo que o conteúdo esteja certo.

## O que cortar

**Reforço vazio.** Frases que não dizem nada, só ocupam espaço fingindo ênfase:
"é importante notar que", "vale destacar que", "cabe ressaltar", "no mundo de hoje",
"na era digital em que vivemos". Se a frase sumir e o parágrafo continuar fazendo
sentido, ela não devia estar lá. Teste: apague a frase inteira. Perdeu informação?
Não? Então estava certo apagar.

**Tricolon decorativo.** Três substantivos ou adjetivos em fileira quando um bastava:
"rápido, eficiente e confiável". "escalável, robusto e moderno". Isso é o padrão mais
reconhecível de texto gerado por modelo — a cadência de três virou clichê do gênero.
Escolha a palavra certa, não as três candidatas.

**Paralelismo mecânico.** Uma lista onde cada item começa com o mesmo verbo e tem o
mesmo comprimento parece gerada por template, porque geralmente é. Varie a estrutura
ou não faça lista onde um parágrafo resolve melhor.

**"Não apenas X, mas também Y".** Essa construção quase nunca é a forma mais direta
de dizer a coisa. Escreva a frase que diz Y, e só adicione X antes se X realmente
precisar estar lá.

**Adjetivo que não muda o sentido.** "Robusto", "poderoso", "revolucionário",
"inovador", "de ponta", "abrangente". Pergunte: se eu tirar essa palavra, o leitor
sabe menos sobre o produto? Normalmente não — porque essas palavras descrevem a
intenção de impressionar, não uma característica real. Troque por um número, um
exemplo, ou corte.

**Voz passiva sem necessidade.** "Foi decidido que" em vez de "decidimos". "A tarefa
é executada pelo agente" em vez de "o agente executa a tarefa". A voz ativa é mais
curta e diz quem fez o quê — que é a informação que normalmente falta no texto de IA.

**Fechamento-resumo.** Não termine parágrafo repetindo o que ele acabou de dizer
("em resumo, isso mostra que..."; "portanto, fica claro que..."). Se o parágrafo foi
claro, o resumo é redundante. Se não foi, resumir não resolve — reescreva o parágrafo.

**Emoji como marcador.** Emoji no lugar de bullet, de ênfase ou de categoria (✅, 🚀,
💡) é o cheiro mais forte de slide de vendas gerado às pressas. Não use para
organizar texto — só, no máximo, quando o próprio conteúdo é sobre algo informal e
faz sentido no contexto humano da frase.

**Abertura genérica.** "No cenário atual, as empresas enfrentam..." é a abertura mais
usada e a menos informativa que existe. Comece pela informação, não pelo cenário.

## Antes / depois

**Antes:**
> No mundo digital de hoje, é importante notar que ter uma boa gestão financeira é
> fundamental para o sucesso de qualquer negócio. Uma ferramenta robusta e eficiente
> não apenas organiza suas finanças, mas também oferece insights poderosos que podem
> revolucionar a forma como você administra sua empresa.

**Depois:**
> Sem controle de caixa diário, é fácil descobrir tarde demais que o mês fechou no
> vermelho. Uma planilha resolve até certo ponto; o problema aparece quando alguém
> esquece de atualizar ou lança errado.

---

**Antes:**
> Nossa plataforma foi desenvolvida pensando em oferecer uma experiência completa,
> intuitiva e personalizada para cada tipo de usuário. Com funcionalidades poderosas
> e uma interface moderna, conseguimos entregar resultados excepcionais.

**Depois:**
> A tela principal mostra o que vence hoje. Não tem configuração — se você tem menos
> de dez clientes, funciona no primeiro dia sem tutorial.

---

**Antes:**
> É fundamental destacar que a comunicação eficaz é a chave para o sucesso de
> qualquer equipe. Times que se comunicam bem não apenas evitam retrabalho, mas
> também constroem um ambiente de trabalho mais colaborativo e produtivo.

**Depois:**
> Time que não alinha antes de começar refaz depois. Isso custa mais tempo do que a
> reunião que foi pulada para "ganhar tempo".

## Checklist antes de publicar

1. Removi todo "é importante notar", "vale destacar" e primos?
2. Tem algum tricolon decorativo (três adjetivos em fila)? Cortei para um?
3. Existe "não apenas X, mas também Y" em algum lugar? Reescrevi direto?
4. Cada adjetivo forte ("robusto", "poderoso", "revolucionário") sobrevive ao
   teste de "e se eu cortar"?
5. As frases passivas viraram ativas onde dava?
6. O comprimento das frases varia, ou tudo tem o mesmo ritmo de manual?
7. Nenhum parágrafo termina resumindo o que ele mesmo acabou de dizer?
8. Não tem emoji fazendo o trabalho de pontuação, e não abre com "no cenário atual"
   ou equivalente?

Se alguma dessas respostas for "não", o texto não está pronto — reescreva antes de
chamar `publicar_pagina`.
