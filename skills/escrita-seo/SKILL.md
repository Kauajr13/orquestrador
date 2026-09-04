---
quando: ao escrever uma página para publicar_pagina que precisa achar leitor sozinha, via busca
---

# Escrita SEO

O site é o canal de distribuição grátis desta empresa: não tem orçamento de
anúncio, então cada página precisa se pagar sozinha aparecendo para quem já está
procurando a resposta. Isso muda como você escreve — não é redação de blog
corporativo, é responder uma pergunta específica melhor do que quem já responde
essa pergunta hoje.

Esta skill não substitui `humanizer`: toda página passa pelas duas. Humanizer
cuida de como a frase soa; esta skill cuida de se a página merece existir e se
alguém vai achá-la.

## Escreva para uma pergunta real

Antes de escrever, tenha em mente a frase exata que alguém digitaria numa busca —
não o assunto genérico. "Gestão financeira para pequenas empresas" é assunto.
"Quanto cobrar de mensalidade de lava-jato" é pergunta. A página que responde uma
pergunta específica compete contra menos conteúdo e serve melhor quem chega nela,
porque quem chegou já sabe o que quer saber.

Se você não consegue formular a pergunta exata que a página responde, ainda não
sabe o que vai escrever — volte um passo.

## Título específico, não genérico

**Isto não:** "Guia completo de gestão para lava-jatos"
**Isto sim:** "Quanto cobrar de mensalidade em um lava-jato (com exemplo de cálculo)"

O título genérico promete tudo e não compromete com nada — é o que todo mundo
escreve, e por isso não se destaca em busca nem convence quem está decidindo se
clica. O título específico já mostra que a página resolve aquele problema exato.

## A primeira frase já entrega a resposta

Não abra com contexto, história do setor ou "para responder essa pergunta, é
preciso entender primeiro...". A pessoa que chegou pela busca quer a resposta
logo, e decide em segundos se continua lendo com base nisso. Dê o número, o
critério ou a resposta direta na primeira frase, e desenvolva depois.

**Isto não:** "A precificação é um dos temas mais debatidos no setor de lava-jato,
e envolve diversos fatores que merecem atenção cuidadosa."

**Isto sim:** "A maioria dos lava-jatos brasileiros cobra entre R$ 80 e R$ 150 de
mensalidade por carro, variando principalmente pelo número de lavagens incluídas."
(com fonte, se for número — ver seção abaixo)

## Estrutura com subtítulos que são perguntas

Quem escaneia a página lê os subtítulos antes do texto. Se os subtítulos forem
perguntas ("Como calcular o preço por lavagem?", "Vale a pena cobrar por pacote
mensal?"), quem escaneia já sabe onde está a resposta que procura e mecanismo de
busca também entende melhor do que a página trata. Subtítulo genérico ("Introdução",
"Considerações finais", "Conclusão") não ajuda nenhum dos dois.

## Slug curto

`/quanto-cobrar-lavajato`, não `/como-calcular-o-preco-ideal-de-mensalidade-para-o-seu-lava-jato-em-2026`.
Slug curto é mais fácil de lembrar, de linkar, e de ler na URL antes mesmo de
clicar. Corte para o essencial da pergunta.

## Resumo que funciona como meta description

O campo `resumo` de `publicar_pagina` aparece na listagem do site e serve de meta
description — é o texto que decide se alguém clica quando a página aparece na
busca. Escreva uma ou duas frases que respondam "o que eu ganho lendo isso",
não um resumo vago do tema. "Neste artigo falamos sobre precificação" não
convence ninguém a clicar; "Veja a faixa de preço praticada e como calcular a
sua em três passos" convence.

## Link interno

Se a página menciona um conceito que outra página da empresa já explica melhor —
ou se ela é o próximo passo natural depois de outra —, linke. Link interno ajuda
quem lê a continuar navegando dentro do site (em vez de sair) e ajuda os
mecanismos de busca a entender que as páginas fazem parte do mesmo conjunto.
Não force link que não ajuda o leitor só para ter link.

## A barra anti-slop

Antes de publicar, pergunte: **esta página ensina algo que a pessoa não saberia
sozinha, só de pensar um minuto?** Se a resposta é não — se é só reformulação
óbvia do óbvio, "para ter sucesso é preciso se dedicar" travestido de artigo — não
publique. Página que não ensina nada não atrai link, não retém leitor e machuca a
credibilidade do domínio inteiro, inclusive das páginas boas.

O teste prático: se você tirasse o nome da empresa e publicasse em qualquer outro
lugar, alguém acharia essa página útil o bastante para voltar a ela? Se a resposta
é "não, é conteúdo de preencher espaço", não vale publicar.

## Toda afirmação com número, preço ou atribuição precisa de fonte

Isto não é conselho — é regra que a própria ferramenta aplica. `publicar_pagina`
detecta padrão de afirmação factual (número, `%`, `R$`, "segundo", "conforme", "de
acordo com") e recusa publicar se não houver fonte citada cobrindo aquilo.

Na prática: todo número que você usar veio de algum lugar — anote de onde durante
a pesquisa (veja a skill `pesquisa-com-fonte`) e inclua a URL no campo `fontes`
antes de publicar. Se não tem fonte para um número, ou tira o número do texto, ou
troca por algo que você pode sustentar sem citação (uma explicação de raciocínio,
por exemplo, em vez de uma estatística).
