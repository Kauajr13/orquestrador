# Este repositório é a empresa

Não é um produto que uma empresa mantém. É a empresa em si: os funcionários, o expediente,
as regras e a memória estão todos aqui dentro. Quem lê este arquivo — pessoa ou agente —
está lendo o manual de como trabalhar neste lugar.

## O que a empresa faz

Ainda não se sabe, e isso é de propósito. O nicho será escolhido por um agente de pesquisa,
com evidência; o nome, por um agente de branding. Nenhum dos dois existe ainda: serão
contratados pelo Gestor quando ele julgar que fazem falta.

O objetivo é gerar receita. A fase atual é **validar demanda antes de tentar vender** — não
se constrói produto antes de haver sinal de que alguém o quer.

## Hierarquia

```
Kauã (chefe, humano)     CNPJ, compras, assinaturas, contratos
   └── Gestor            estratégia, metas, contratação, promoção
         └── Engenharia  → Dev, Revisor
```

Times novos aparecem quando o Gestor contrata. Quando um time passa de quatro membros, ele
ganha um líder e os relatórios passam a subir por ele.

Escalonamento sobe a cadeia: travou, vai para o superior. Só o Gestor fala com o Kauã, e só
pela ferramenta `pedir_providencia`. Se todo agente pudesse chamar o chefe, o Telegram dele
viraria lixeira e ninguém leria mais nada.

## A fronteira

Os agentes vão do zero até "produto pronto, página no ar, cobrança configurada, faltando o
botão". Abrir CNPJ, passar por KYC, comprar, assinar contrato e registrar marca exigem uma
pessoa real — e essa pessoa é o Kauã. Não tente contornar isso: não é limitação técnica, é
como o mundo funciona. Use `pedir_providencia` e siga trabalhando no que não depende disso.

## Regras invioláveis

Estão em `CONSTITUICAO.md`, cada uma com um teste em `testes/constituicao.test.ts`. Um PR
que enfraquece qualquer uma delas reprova no CI mesmo com o Revisor aprovando. Alterar a
constituição ou seus testes exige aprovação humana.

Leia antes de mexer em qualquer coisa dentro de `lib/agentes/`.

## Como o trabalho acontece

O relógio é um GitHub Actions que chama `/api/cron/expediente` a cada 15 minutos. Cada tick
avança **um pedaço** de uma tarefa e salva o estado — funções da Vercel morrem em 60s, e um
raciocínio longo não cabe nisso. O próximo tick retoma de onde parou, lendo
`execucoes.conversa`.

Uma tarefa caminha assim:

```
pendente → em_andamento → em_revisao → aprovada → concluida
                       ↘ mudancas_pedidas ↗
                       ↘ bloqueada (3 tentativas, escala pro superior)
```

Publicar conteúdo **não** passa por esse caminho: é uma linha em `paginas`, sem build e sem
deploy. Mudar o sistema passa: PR, Revisor, CI, merge.

## Convenções de código

- **Tudo em português**: funções, tipos, colunas, comentários. `supabaseDaSessao()`, não
  `getSessionClient()`.
- Comentário explica **por que**, não o quê. Se registrar uma decisão, datar.
- Next 16 App Router, React 19, TypeScript strict, npm.
- `app/`, `lib/`, `components/` na raiz. Sem `src/`.
- Tailwind v4 sem arquivo de config — o tema vive em `app/globals.css` com `@theme inline`.
- Supabase via `@supabase/ssr`. O app usa o **JWT da sessão, nunca a service_role**: ela
  ignora RLS, e aí um erro de query vaza dado sem o banco reclamar. A service_role só
  aparece no runner, no servidor.
- **Sem SDK de LLM.** Uma chamada de `chat/completions` são ~30 linhas de `fetch`, e a SDK
  traria dependência sem resolver nada. Ver `lib/ai/openai-compat.ts`.
- **Sem biblioteca de UI.** A interface é pixel art autoral; um design system genérico
  atrapalharia mais do que ajudaria.

## Comandos

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção
npm test             # testes (inclui os da constituição)
npm run db:migrate   # aplica supabase/schema.sql via Management API
npm run lint:sql     # barra DDL destrutivo
```

Deploy é `vercel --prod` a partir da raiz do repositório, nunca de um worktree.

## Onde as coisas ficam

```
app/            rotas; (publico) é o site, o resto é o painel interno
lib/agentes/    runner, prompt-base, ferramentas, hierarquia, skills
lib/ai/         camada de LLM, trocável por env var
lib/conformidade/  mascaramento de PII e checagem de originalidade
skills/         ofício empacotado, um SKILL.md por pasta
supabase/       schema e migrations — território que exige aprovação humana
testes/         constituição e o que mais aparecer
```
