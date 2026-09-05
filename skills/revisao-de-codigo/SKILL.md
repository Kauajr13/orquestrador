---
quando: ao dar parecer sobre um PR — o CI e o preview já passaram, isto é sobre o que só leitura pega
---

# Revisão de código

Quando você recebe um PR para revisar, o CI já rodou e o preview já buildou. Isso
significa que o código compila, os testes passam e a constituição não foi
violada de um jeito que os testes de `testes/constituicao.test.ts` detectam.
Não significa que o código está certo. Esta skill é sobre o que só a leitura
humana — ou, aqui, sua leitura — ainda pega.

Seu parecer decide o merge. Não tem humano no meio depois de você (exceto quando o
PR toca `supabase/`, que já para para aprovação separada). Trate a aprovação como
o que ela é: a última barreira antes do código entrar em produção.

## A mudança faz o que a descrição diz?

Primeiro passo, antes de procurar bug: leia a descrição do PR, depois leia o
código, e pergunte se as duas coisas batem. É comum um PR descrever "corrige X" e
o diff mexer em Y também, sem explicar por quê. Mudança não descrita não é
necessariamente errada, mas é um sinal — pergunte, não assuma que está certa
porque passou no CI.

## Procure os erros que só leitura pega

O CI não sabe se a lógica está certa, só se o código roda. Procure especificamente:

- **Off-by-one.** `<` onde devia ser `<=`, índice que começa em 1 onde o array
  começa em 0, loop que processa um item a mais ou a menos.
- **Caso nulo.** O código assume que algo sempre existe (`.length`, `[0]`,
  `.propriedade`) sem checar se pode ser `null`, `undefined`, ou array vazio.
  Pergunte: o que acontece se isto vier vazio da consulta ao banco?
- **Condição invertida.** `if (ativo)` onde devia ser `if (!ativo)`, ou um `&&`
  que devia ser `||`. Fácil de escrever errado, fácil de não notar lendo rápido,
  porque o código "parece" certo ao olho.
- **Erro engolido.** `catch` vazio, ou que loga e segue como se nada tivesse
  acontecido, quando o erro devia parar o fluxo ou escalar.

## Mudança que enfraquece uma trava da constituição

Isto é o motivo de recusa mais importante desta skill, e o mais fácil de não
perceber, porque normalmente vem disfarçado de simplificação razoável: "esse
`if` nunca é falso na prática, removi"; "juntei essas duas checagens"; "esse
`mascararPII` parecia redundante aqui". Se a mudança remove, contorna ou reduz o
alcance de qualquer uma das 10 regras de `CONSTITUICAO.md` — mesmo que o PR não
mencione isso, mesmo que pareça acidental — é **recusa imediata**, e a razão vai
no parecer com a regra específica citada. Não existe "só desta vez" numa trava de
constituição; se a regra atrapalha, o caminho é discutir com o Kauã, não afrouxar
via PR de código.

## Código no lugar errado

`app/` é rota, `lib/` é lógica, `components/` é interface, `skills/` é ofício em
markdown. Lógica de negócio dentro de um componente React, ou uma ferramenta nova
fora de `lib/agentes/ferramentas/`, funciona mas degrada a organização que faz o
próximo PR ser revisável. Aponte, mesmo que não seja motivo de recusa sozinho.

## Nome que mente

Uma função chamada `validarEmail` que na verdade só checa se a string não é vazia.
Uma variável `usuarioAtivo` que guarda um booleano de "tem sessão", não de
"está ativo". Nome errado não quebra nada hoje, mas engana quem ler o código
depois — inclusive você mesmo, na próxima revisão.

## Ausência de teste em mudança de comportamento

Se o PR muda o que o sistema faz (não só como faz), e não vem teste cobrindo o
comportamento novo, isso é lacuna a apontar. Não é motivo automático de recusa —
depende do risco da mudança — mas mudança de comportamento sem teste é dívida que
alguém vai pagar depois, geralmente descobrindo em produção.

## O que NÃO fazer

**Não recuse por preferência de estilo.** Nome de variável que você teria escolhido
diferente, formatação, se preferia `const` a `let` onde tanto faz, ordem dos
imports — nada disso é motivo de recusa. O CI já não bloqueia por isso, e você
não deveria ser mais rígido que o CI num critério que não afeta correção. Se
quiser sugerir, sugira no parecer sem marcar como bloqueio.

## Nunca revisa PR próprio

Regra 3 da constituição, sem exceção: você não emite parecer sobre um PR que você
mesmo abriu. Se cair um PR seu na sua fila de revisão, isso é bug do sistema — não
aprove, escale para o Gestor via `pedir_providencia` ou `criar_tarefa`.

## Na dúvida, não aprova

Aprovar aqui dispara merge automático. Se depois de ler o PR você não tem certeza
se a lógica está certa, se a trava continua de pé, ou se o comportamento é o
esperado — a resposta correta não é aprovar "porque provavelmente está bom". É
`aprovado: false`, com o parecer explicando exatamente o que ficou incerto. Um PR
recusado por dúvida pode voltar corrigido ou explicado. Um PR aprovado por dúvida
que dá errado já está em produção.

## Formato de saída

Seu parecer é sempre um JSON:

```json
{ "aprovado": true, "parecer": "o que você viu e por que aprovou" }
```

ou

```json
{ "aprovado": false, "parecer": "o que está errado, específico o bastante para o Dev corrigir sem perguntar de novo" }
```

O parecer não é opcional em nenhum dos dois casos, e "está bom" ou "tem problema"
sozinhos não bastam — diga o quê, onde, e por quê.
