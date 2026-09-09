# Especificação do Painel de Custo Projetado

## Visão geral
O Painel de Custo Projetado tem como objetivo centralizar a visualização das despesas previstas versus as despesas reais, permitindo que gestores e analistas financeiros acompanhem a performance orçamentária de forma rápida e interativa.  O painel será parte do **Dashboard Financeiro** da aplicação.

## Métricas principais
| Métrica | Descrição | Fonte de Dados |
|---|---|---|
| **Custo Projetado** | Valor total previsto para o período selecionado. | Modelo de projeção (p. ex. regressão, forecast) |
| **Custo Real** | Valor gasto efetivamente registrado no ERP/sistema de contabilidade. | Base de custos reais |
| **Desvio (Valor)** | Diferença entre custo projetado e real (Projeto – Real). | Cálculo interno |
| **Desvio (%)** | Percentual do desvio em relação ao custo projetado. | Cálculo interno |
| **Custo Acumulado** | Soma dos custos ao longo do tempo (cumulativo). | Agregação temporal |
| **Meta de Custo** | Valor alvo definido pelo planejamento. | Planejamento orçamentário |

## Filtros
- **Projeto / Produto** – seleção múltipla de projetos ou produtos.
- **Departamento / Centro de Custo** – filtro por estrutura organizacional.
- **Tipo de Despesa** – ex.: CAPEX, OPEX, Licenças, Serviços.
- **Responsável** – filtro por owner ou equipe.
- **Tag de Custo** – tags customizáveis definidas pelo usuário.

## Período de análise
- **Seleção de intervalo** – calendário com início e fim (dia, mês, trimestre, ano).
- **Períodos pré‑definidos** – `Últimos 7 dias`, `Último mês`, `Trimestre corrente`, `Ano corrente`, `Ano anterior`.
- **Granularidade** – visualização por `Dia`, `Semana`, `Mês`, `Trimestre`.

## Interatividade
- **Hover** sobre gráficos exibe tooltip com valores detalhados.
- **Clique** em barras ou linhas para “drill‑down” até a lista de lançamentos que compõem o valor.
- **Exportar** em CSV/Excel ou PDF.
- **Salvar vista** como “Favoritos” para acesso rápido.
- **Modo comparativo** – exibir dois períodos lado a lado.

## Layout e componentes UI
1. **Barra de filtros** (topo) – campos de seleção descritos acima, com ícones de calendário e busca.
2. **Cartões de métricas** – quatro cartões horizontais mostrando Custo Projetado, Custo Real, Desvio (Valor) e Desvio (%). Cada cartão tem cor indicativa (verde para desvio positivo, vermelho para negativo).
3. **Gráfico principal** – gráfico de linhas (ou combo de barras + linhas) com eixo X = tempo, eixo Y = valor monetário. Linha azul = projetado, linha verde = real, área sombreada = desvio.
4. **Tabela detalhada** – listagem de linhas de custo com colunas: Data, Descrição, Tipo, Valor Projetado, Valor Real, Desvio, Centro de Custo.
5. **Sidebar** (opcional em telas largas) – atalhos para “Meta de Custo”, “Configurações de Projeção” e “Ajuda”.

## Responsividade
- Layout mobile: filtros colapsáveis em um drawer; cartões empilhados verticalmente; gráfico ocupa a maior parte da tela; tabela substituída por lista resumida.
- Tablet: dois cartões por linha, barra de filtros fixa no topo.

## Requisitos não‑funcionais
- **Performance**: tempo de carregamento ≤ 2 s para intervalos até 1 ano.
- **Acessibilidade**: contraste ≥ 4.5:1, navegação por teclado, ARIA labels.
- **Internacionalização**: suporte a moeda e formato de data configuráveis.
- **Segurança**: apenas usuários com permissão `finance_view` podem acessar.
- **Testabilidade**: componentes React devem ter cobertura de teste unitário ≥ 80 %.

## Critérios de aceite
- O painel exibe corretamente todas as métricas acima.
- Filtros afetam todas as visualizações simultaneamente.
- Exportação gera arquivo CSV com as mesmas colunas da tabela detalhada.
- UI corresponde ao mockup de alta fidelidade (ver design/painel_custo_projetado/mockup.svg).
- Não há regressão em dispositivos mobile.

---
*Documento gerado automaticamente por Dev como parte da definição de requisitos do Painel de Custo Projetado.*