# Rotina de Retrospectiva Semanal

## 1. O que é a rotina de retrospectiva semanal

A *retrospectiva semanal* é um job interno que coleta métricas de desempenho da aplicação, gera um resumo das principais ocorrências da semana (erros, alertas, deploys) e grava esses dados em logs estruturados. Ela serve como base para as discussões de melhoria contínua da equipe.

## 2. Como ela funciona

| Etapa | Descrição |
|-------|-----------|
| **Quando é executada** | Por padrão, a rotina roda ** toda segunda‑feira às 09:00 (horário UTC) ** usando o agendador configurado no `package.json` (via `npm run retrospectiva:weekly`). |
| **O que faz** | 1. Busca logs de eventos da semana anterior a partir do banco de dados.
| | 2. Agrupa os dados por tipo (erros, deploys, alertas).
| | 3. Gera um relatório resumido e grava em `logs/retrospectiva/`.
| **Quando pausa** | Caso a flag `RETROSPECTIVA_PAUSED` esteja definida como `true` nas variáveis de ambiente, o job termina imediatamente sem gerar nenhum relatório. |

A implementação está no arquivo **[lib/rotinas/retrospectiva‑semanal.ts](lib/rotinas/retrospectiva-semanal.ts)**.  A função exportada é:

```ts
export async function executarRetrospectivaSemanal(): Promise<void>
```

## 3. Como executar manualmente

```bash
# Instale dependências (caso ainda não tenha feito)
npm install

# Executa a rotina imediatamente
npm run retrospectiva:run
```

O script `npm run retrospectiva:run` está mapeado em `package.json`:

```json
"scripts": {
  "retrospectiva:run": "ts-node lib/rotinas/retrospectiva-semanal.ts"
}
```

A saída típica no console é algo como:

```
[INFO] Iniciando retrospectiva semanal...
[INFO] Buscando logs de 2024-09-02 a 2024-09-08
[INFO] Encontrados 124 erros, 7 alertas, 3 deploys
[INFO] Relatório salvo em logs/retrospectiva/2024-09-08.md
[INFO] Retrospectiva concluída com sucesso.
```

## 4. Como agendar ou desagendar a rotina

### Agendar (padrão)

A rotina já está agendada via **GitHub Actions** (arquivo `.github/workflows/retrospectiva.yml`). Caso precise alterar o horário:

1. Abra o arquivo ` .github/workflows/retrospectiva.yml `.
2. Modifique a expressão cron, por exemplo, para rodar às 14h UTC:

```yaml
on:
  schedule:
    - cron: "0 14 * * MON"
```
3. Commit e push das mudanças.

### Desagendar temporariamente

Defina a variável de ambiente `RETROSPECTIVA_PAUSED=true` no arquivo de configuração de ambiente (`.env` ou nas variáveis de CI). Exemplo:

```bash
# .env
RETROSPECTIVA_PAUSED=true
```

Para reativar, basta remover ou definir como `false`.

## 5. Como verificar logs e resultados

- **Logs da execução**: São enviados ao console da ação do GitHub e também gravados em `logs/retrospectiva/` com timestamp.
- **Relatório gerado**: Arquivo Markdown `logs/retrospectiva/YYYY-MM-DD.md`. Abra no VS Code ou visualize via `cat`.

Exemplo de comando para listar os últimos relatórios:

```bash
ls -l logs/retrospectiva/*.md | tail -n 5
```

## 6. Como resolver problemas comuns

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| **Rotina não executa** | Agendamento desativado ou flag de pausa ativada. | Verifique `RETROSPECTIVA_PAUSED` nas variáveis de ambiente. Revise o cron no workflow (`.github/workflows/retrospectiva.yml`). |
| **Erro ao conectar ao banco** | Credenciais ausentes ou expiradas. | Atualize as variáveis `DB_URL`, `DB_USER`, `DB_PASS` no `.env` ou no secret do GitHub. |
| **Relatório vazio** | Intervalo de datas incorreto (ex.: timezone). | Confirme que o fuso horário do servidor está em UTC ou ajuste a lógica de cálculo de datas em `retrospectiva‑semanal.ts`. |
| **A pausa não funciona** | Variável de ambiente não está sendo lida. | Garanta que `process.env.RETROSPECTIVA_PAUSED` está sendo lida antes de iniciar a lógica; reinicie o job após alterar a variável. |

---

### Referências rápidas
- **Script principal**: `lib/rotinas/retrospectiva-semanal.ts`
- **Workflow CI**: `.github/workflows/retrospectiva.yml`
- **Comandos npm**: `npm run retrospectiva:run`, `npm run retrospectiva:weekly`

Qualquer dúvida, abra um issue no repositório ou pergunte ao gestor.
