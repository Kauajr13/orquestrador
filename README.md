# Escritório

Uma empresa tocada por agentes de IA. Eles pesquisam, escrevem código, revisam o
trabalho uns dos outros, publicam conteúdo e contratam colegas quando falta
gente. O chefe é humano e só é chamado para o que exige uma pessoa de verdade.

O painel mostra tudo isso como um escritório 8-bit em tempo real.

> Codinome. O nome definitivo será proposto por um agente de branding, depois que
> um agente de pesquisa escolher o nicho. Renomear o repositório no GitHub não
> quebra nada.

## Como funciona

Um GitHub Actions bate na rota `/api/cron/expediente` a cada 15 minutos. Cada
chamada faz **um pedaço** de trabalho e devolve o controle — função da Vercel
morre em 60 segundos, e o raciocínio de um agente não cabe nisso. O estado fica
salvo em `execucoes.conversa`, então o próximo tick continua de onde o anterior
parou.

Uma tarefa de código caminha assim:

```
pendente → em_andamento → em_revisao → concluída
                       ↘ mudancas_pedidas ↗
                       ↘ bloqueada → sobe pro superior → Telegram
```

O Revisor passa por quatro filtros antes de aprovar, e o parecer do modelo é o
último de propósito, por ser o menos confiável dos quatro:

1. mexeu em `supabase/`? espera aprovação humana
2. o CI está verde?
3. o preview da Vercel carrega?
4. e só então a leitura do código

Publicar conteúdo **não** passa por esse caminho: é uma linha na tabela
`paginas`, sem build e sem deploy. Marketing não fica refém do ciclo de código,
e conteúdo não derruba a aplicação.

## Regras que não se negociam

Estão em [CONSTITUICAO.md](CONSTITUICAO.md) — dez, cada uma com um teste em
`testes/constituicao.test.ts` que prova que ela continua valendo. Um PR que
enfraquece qualquer uma reprova no CI mesmo com o Revisor aprovando.

Isso existe porque o merge aqui é automático. Sem esses testes, as travas
desapareceriam sozinhas ao longo de algumas semanas — não por sabotagem, mas por
uma sequência de PRs de "simplificação" que pareceriam razoáveis um a um.

## Rodando

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o painel abre em **modo demonstração**, com um
escritório de mentira e o aviso na tela. Dá para trabalhar na interface inteira
assim.

## Ligando de verdade

Copie `.env.example` para `.env.local` e preencha. Depois:

```bash
npm run db:migrate                          # cria o schema
npm run db:migrate supabase/002-seed.sql    # contrata Gestor, Dev e Revisor
npm run db:check                            # confere que as tabelas existem
```

Faltam três coisas fora do código:

1. **Branch protection** na `main`: exigir PR e CI verde, sem push direto.
2. **Segredos do GitHub Actions**: `URL_PRODUCAO`, `CRON_SECRET`,
   `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (os dois últimos só
   para o backup diário).
3. **Webhook do Telegram**, para os botões de aprovação funcionarem:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<seu-dominio>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Comandos no Telegram: `/pausar`, `/voltar`, `/status`.

## Comandos

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção
npm test             # testes, inclusive os da constituição
npm run typegen      # tipos de rota do Next (o CI roda antes do tsc)
npm run lint:sql     # barra DDL destrutivo
npm run db:migrate   # aplica supabase/schema.sql
```

Deploy: `vercel --prod` a partir da raiz do repositório, nunca de um worktree.

## Onde as coisas ficam

```
app/            painel em /, site público em /site
lib/agentes/    runner, prompt-base, ferramentas, hierarquia, revisão
lib/ai/         camada de LLM — trocar de provedor é trocar env var
lib/conformidade/  mascaramento de PII e checagem de originalidade
skills/         ofício empacotado, um SKILL.md por pasta
supabase/       schema e seed — território que exige aprovação humana
testes/         a constituição
```

[AGENTS.md](AGENTS.md) é o manual que os próprios agentes leem para trabalhar
aqui. É o arquivo que mais importa manter honesto: quando ele mente, todo mundo
erra junto.

## O que uma IA não faz

Abrir CNPJ, passar por KYC, comprar, assinar contrato, registrar marca. Não é
limitação técnica, é como o mundo funciona. Quando um agente esbarra nisso, ele
usa `pedir_providencia` e o pedido chega no Telegram do chefe em horário
comercial.
