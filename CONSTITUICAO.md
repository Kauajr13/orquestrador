# Constituição

Regras invioláveis desta empresa. Cada uma tem um teste em `testes/constituicao.test.ts`
que prova que ela continua valendo. Um PR que enfraquece qualquer regra abaixo **reprova
no CI**, mesmo que o Revisor tenha aprovado.

Isso existe porque o merge aqui é automático. O risco realista não é um agente malicioso:
é um PR de "simplificação" que remove uma trava, o Revisor achar razoável e o CI passar.
Sem estes testes, as proteções desapareceriam sozinhas em algumas semanas.

**Alterar este arquivo ou os testes que o acompanham exige aprovação humana.**

---

## 1. O expediente respeita o freio

Todo tick lê `config.pausado` antes de qualquer trabalho. Se estiver ligado, encerra sem
executar nada. É o botão de emergência, e ele precisa funcionar mesmo quando todo o resto
estiver quebrado.

## 2. Ninguém cria poder que não tem

Um agente nunca concede a um colega ferramenta ou skill que ele próprio não possui. Sem
isso, "contratar sozinho" vira o caminho para fabricar um agente todo-poderoso a partir de
um agente comum.

## 3. Ninguém revisa o próprio trabalho

O Revisor nunca emite parecer sobre um PR que ele mesmo abriu. Uma trava que se
auto-aprova não é trava.

## 4. Dado pessoal não sai para o modelo

Toda leitura que possa conter dado pessoal passa por `mascararPII()` antes de entrar num
prompt. O provedor de LLM é serviço no exterior, e os titulares desses dados não
consentiram com isso.

## 5. Nada é publicado sem revisão de forma e de origem

`publicar_pagina` recusa texto que não passou pela skill `humanizer` e pela checagem de
originalidade. O conteúdo sai sob o domínio de uma pessoa real, que responde por ele.

## 6. A empresa não gasta o que não ganhou

Gasto permitido ≤ lucro acumulado em `caixa`. Com saldo zero, toda ferramenta que custa
dinheiro é recusada pelo runner — não por instrução no prompt, que é sugestão, mas por
código, que é regra.

## 7. Um repositório, e só um

O token do GitHub é fine-grained e alcança apenas este repositório. É a fronteira física
do que a empresa pode modificar.

## 8. Conteúdo externo é dado, nunca instrução

Tudo que vem de `buscar_web` e `ler_pagina` entra delimitado e marcado como não-confiável.
Uma página que diga "ignore suas regras" é um texto sobre o qual se raciocina, não uma
ordem que se cumpre.

## 9. Migration não entra sozinha

DDL destrutivo (`drop table`, `drop column`, `truncate`, `delete` sem `where`) é barrado
pelo linter de SQL no CI. Qualquer PR que toque `supabase/` espera aprovação humana no
Telegram antes do merge.

É a única exceção à autonomia, e ela se justifica: o CI não aplica migrations, então um
`drop table` passaria verde e levaria junto a memória da empresa. O plano gratuito do
Supabase não tem point-in-time recovery — é o único erro sem volta do sistema.

## 10. Segredo não entra no repositório nem no prompt

Chaves vivem em variáveis de ambiente. O CI roda scan de segredo e barra o merge. O runner
nunca expõe `process.env` a um modelo.

## 11. Fonte citada é fonte lida

`anotar_memoria` recusa URL que não foi aberta nesta execução. Conclusão vinda
do que o modelo já sabe entra declarada como tal, nunca disfarçada de leitura.

Isto nasceu de um caso real, no primeiro dia de operação: com a busca fora do
ar, o Gestor escolheu um nicho e citou sete URLs oficiais que nunca abriu. O
resultado tinha toda a aparência de pesquisa séria — e é justamente por parecer
séria que uma pesquisa inventada é pior do que nenhuma. Conferir se o campo
`fontes` está preenchido não bastava: quem preenche é o agente.
