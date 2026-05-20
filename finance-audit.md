# Auditoria Visual — Módulo Financeiro
> Gerado em 2026-05-11 com base na leitura completa do código-fonte.  
> Cada seção descreve o que aparece em tela, como está organizado e o que está confuso ou mal distribuído.

---

## 1. `/finance/overview` — Visão Geral

### Layout atual (de cima para baixo)

```
┌─ ModuleHeader ─────────────────────────────────────────────────────┐
│  [← Hub] (oculto no desktop)    Visão Geral         [spacer]       │
└────────────────────────────────────────────────────────────────────┘

┌─ Header ───────────────────────────────────────────────────────────┐
│  Visão Geral  (h1 22px bold)                                       │
│  maio de 2026  (13px, muted)              [sem botão de ação]      │
└────────────────────────────────────────────────────────────────────┘

┌─ Stat Cards (grid 4 colunas) ──────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │GANHO CLT │ │GANHO     │ │TOTAL     │ │POUPANÇA  │              │
│  │          │ │COMPLETO  │ │GASTO     │ │ACUM.     │              │
│  │R$ 7.520  │ │R$ 8.277  │ │R$ 8.466  │ │R$ 1.163  │              │
│  │ (verde)  │ │  (azul)  │ │(vermelho)│ │  (ciano) │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
└────────────────────────────────────────────────────────────────────┘

CENÁRIOS DE BALANÇO  ─────────────────────────────────────────────────

┌─ Cenário CLT ─────────┐  ┌─ Cenário Completo ────────┐
│ CENÁRIO CLT            │  │ CENÁRIO COMPLETO           │
│ R$ 7.520 ganhos        │  │ R$ 8.277 ganhos            │
│ -R$ 946  (vermelho)    │  │ -R$ 189  (vermelho)        │
│ déficit de R$ 946      │  │ déficit de R$ 189          │
└───────────────────────┘  └────────────────────────────┘

POUPANÇA ACUMULADA  ──────────────────────────────────────────────────

┌─ savingsHero ──────────────────────────────────────────────────────┐
│ Poupança Acumulada  (label interno, 12px, muted)                   │
│ R$ 1.163,00  (36px, gradiente verde-ciano)                        │
│ meta final: R$ 50.000,00                                           │
│ ████░░░░░░░░░░░░░░░░░░░░░  (barra 6px, ~2.3%)                     │
│ 2.3% da meta          faltam R$ 48.837,00                          │
└────────────────────────────────────────────────────────────────────┘

META DE POUPANÇA MENSAL  ────────────────────────────────────────────

┌─ Cenário CLT ─────────┐  ┌─ Cenário Completo ────────┐
│ CENÁRIO CLT            │  │ CENÁRIO COMPLETO           │
│ -R$ 946 (vermelho)     │  │ -R$ 189 (vermelho)         │
│ déficit — cuidado      │  │ déficit — cuidado          │
└───────────────────────┘  └────────────────────────────┘

HISTÓRICO DE POUPANÇA  ──────────────────────────────────────────────

┌─ Timeline (últimas 8 entradas) ────────────────────────────────────┐
│  ● julho/25       R$ 500,00   ✓ (verde)                           │
│  ● agosto/25      R$ 600,00   ✓ (verde)                           │
│  ◌ setembro/25    R$ 700,00                                        │
│  ◌ outubro/25     R$ 800,00                                        │
│  ◉ novembro/25    R$ 900,00   atual (ciano, brilho)                │
│  ◌ dezembro/25    R$ 1.000,00                                      │
│  ◌ janeiro/26     R$ 1.100,00                                      │
│  ◌ fevereiro/26   R$ 1.200,00                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Problemas identificados

1. **Tripla repetição dos cenários** — "Cenários de Balanço" (cards de cenário) + "Meta de Poupança Mensal" (metaCards) mostram **exatamente os mesmos valores** (`saldoCLT` e `saldoTudo`). São 4 cards para 2 números. Desnecessário.

2. **Label dupla no savingsHero** — A seção acima já diz "POUPANÇA ACUMULADA" e o card interno repete "Poupança Acumulada" como label. Ruído visual sem função.

3. **Stat cards redundantes com cenários** — Os 4 stat cards no topo mostram ganhoCLT, ganhoTudo, gastosBudget, poupança. Abaixo, os cenários repetem ganhoCLT e ganhoTudo. O usuário vê os mesmos números 3 vezes.

4. **Sem botão de ação** — Única sub-página do financeiro sem CTA. Não tem como registrar gasto, nem navegar para nada. Página passiva sem próximo passo claro.

5. **Sem sideCol** — As páginas antigas tinham um painel lateral com balanço. As novas sub-páginas não têm, deixando a área da direita (~320px) sempre vazia no desktop.

6. **Timeline mostra "últimas 8 entradas"** mas o historico pode ter 18+ meses. O corte é arbitrário e o usuário não sabe quantas entradas existem.

---

## 2. `/finance/expenses` — Gastos

### Layout atual (de cima para baixo)

```
┌─ ModuleHeader ─────────────────────────────────────────────────────┐
│  [← Hub] (oculto)              Gastos           [spacer]           │
└────────────────────────────────────────────────────────────────────┘

┌─ Header ───────────────────────────────────────────────────────────┐
│  Gastos  (h1)                                 [+ Registrar] (verde)│
│  maio de 2026                                                       │
└────────────────────────────────────────────────────────────────────┘

VARIÁVEIS — QUANTO RESTA                     + Registrar gasto  ──────

┌─ Card variável (ex: Mercado) ──────────────────────────────────────┐
│  Mercado                                hoje: R$ 45,00             │
│  R$ 255,00  (verde — abaixo de 60%)                                │
│  ████████░░░░░░░░░  (barra colorida)                                │
│  64% do orçamento gasto                          orç. R$ 700,00    │
└────────────────────────────────────────────────────────────────────┘

┌─ Card variável (ex: Comida) ───────────────────────────────────────┐
│  Comida                                 hoje: —                    │
│  R$ 180,00  (verde)                                                 │
│  ██████░░░░░░░░░░░  (barra)                                         │
│  55% do orçamento gasto                          orç. R$ 400,00    │
└────────────────────────────────────────────────────────────────────┘

┌─ Card variável negativo (ex: Outros) ──────────────────────────────┐
│  Outros (Disponível)                    hoje: R$ 30,00             │
│  -R$ 85,00  (VERMELHO — ultrapassou)                               │
│  ████████████████████  (barra cheia, vermelha)                     │
│  115% do orçamento gasto                         orç. R$ 200,00   │
└────────────────────────────────────────────────────────────────────┘

FIXOS                                              R$ 5.432,00  ─────

┌─ Accordion: Casa (3) ─────────────────────────────────────────────┐
│  ▼  Casa  [3]                                      R$ 2.800,00   │
│  (fechado por padrão — clique para expandir)                      │
└───────────────────────────────────────────────────────────────────┘

┌─ Accordion: Pessoal (5) ──────────────────────────────────────────┐
│  ▼  Pessoal  [5]                                   R$ 1.200,00   │
└───────────────────────────────────────────────────────────────────┘

  [quando expandido:]
  ┌────────────────────────────────────────────────────────────────┐
  │  Aluguel                          R$ 800,00          ✓        │
  │  Condomínio                       R$ 300,00          ✓        │
  │  Internet                         R$ 120,00          ○        │
  └────────────────────────────────────────────────────────────────┘

COMPROMISSOS FUTUROS  ───────────────────────────────────────────────

┌─ Card compromisso ─────────────────────────────────────────────────┐
│  Carro (comprado a prazo)              até dez/26 (badge vermelho)  │
│  R$ 850,00/mês                              R$ 7.650,00 restam     │
└────────────────────────────────────────────────────────────────────┘

┌─ Summary ──────────────────────────────────────────────────────────┐
│  Total compromissado                            R$ 7.650,00        │
└────────────────────────────────────────────────────────────────────┘
```

### Problemas identificados

1. **Dois pontos de entrada para o mesmo modal** — Botão "+ Registrar" no header E link "+ Registrar gasto" na section label. Funcionalmente idênticos. Um deles é redundante.

2. **"Hoje: R$ X" é ilegível** — `font-size: 11px`, `color: rgba(255,255,255,0.3)`. Informação útil (quanto já gastei hoje nessa categoria) completamente invisível.

3. **Toast sobrepõe a nav mobile** — `bottom: 90px` não considera que a nav bar mobile tem ~52px + safe area. Em mobile o toast some atrás da barra.

4. **Sem sumário no topo** — Não há visão consolidada de "Total variáveis: R$ X | Total fixos: R$ X | Orçamento total: R$ X". O usuário precisa somar mentalmente.

5. **Todos os accordions fechados por padrão** — Os gastos fixos são importantes mas estão todos escondidos. Para ver qualquer detalhe, é preciso clicar em cada grupo.

6. **Barra de progresso não comunica overflow** — Quando `pct > 100%`, a barra fica cheia e vermelha, mas visualmente parece "100% usado". Não há indicação visual de quanto se ultrapassou (ex: a barra poderia ter um overflow indicator).

7. **Modal com estilos inline** — Todo o modal usa `style={{ ... }}` inline em vez de classes CSS. É inconsistente com o restante do app e dificulta manutenção.

8. **Sem empty state para Variáveis** — Se não houver categorias variáveis, a seção aparece vazia sem mensagem.

---

## 3. `/finance/income` — Ganhos

### Layout atual (de cima para baixo)

```
┌─ ModuleHeader ─────────────────────────────────────────────────────┐
│  [← Hub] (oculto)              Ganhos           [spacer]           │
└────────────────────────────────────────────────────────────────────┘

┌─ Header ───────────────────────────────────────────────────────────┐
│  Ganhos  (h1)                              [sem botão de ação]      │
│  maio de 2026                                                       │
└────────────────────────────────────────────────────────────────────┘

CENÁRIOS DE BALANÇO  ─────────────────────────────────────────────────

┌─ Cenário CLT ─────────┐  ┌─ Cenário Completo ────────┐
│ CENÁRIO CLT            │  │ CENÁRIO COMPLETO           │
│ R$ 7.520 ganhos        │  │ R$ 8.277 ganhos            │
│ -R$ 946  (vermelho)    │  │ -R$ 189  (vermelho)        │
│ déficit de R$ 946      │  │ déficit de R$ 189          │
└───────────────────────┘  └────────────────────────────┘

Gastos do mês (orçamento)                      R$ 8.466,00 (vermelho)

FONTES DE RENDA  ─────────────────────────────────────────────────────

┌─ Card: CLT ────────────────────────────────────────────────────────┐
│  CLT  (label 10px)                                                  │
│  Salário Base                  R$ 6.600,00      recebido (verde)   │
│  Vale Alimentação              R$ 680,00         recebido (verde)  │
│  Vale Refeição                 R$ 240,00         recebido (verde)  │
│  ─────────────────────────────────────────────────────────────     │
│  Total CLT                                       R$ 7.520,00       │
└────────────────────────────────────────────────────────────────────┘

┌─ Card: Ponto de Vista ─────────────────────────────────────────────┐
│  PONTO DE VISTA  (label)                                            │
│  Freela SOS                    R$ 600,00         pendente (cinza)  │
│  Freela The Loft               R$ 157,00         pendente (cinza)  │
│  ─────────────────────────────────────────────────────────────     │
│  Total Ponto de Vista                            R$ 757,00          │
└────────────────────────────────────────────────────────────────────┘

┌─ Card: Empréstimos ────────────────────────────────────────────────┐
│  EMPRÉSTIMOS  (label)                                               │
│  Empréstimo Amor               R$ 0,00           pendente (cinza)  │
│  ─────────────────────────────────────────────────────────────     │
│  Total Empréstimos                               R$ 0,00           │
└────────────────────────────────────────────────────────────────────┘
```

### Problemas identificados

1. **"Cenários de Balanço" é cópia exata do Overview** — Os mesmos dois cards com os mesmos valores (`saldoCLT`, `saldoTudo`) aparecem em Overview e Income. Nenhum dado novo.

2. **Label "Gastos do mês (orçamento)" dentro da página de Ganhos** — Um número de gastos (`gastosBudget`) em vermelho aparece como section label inline numa página chamada "Ganhos". É confuso: o usuário está vendo **despesas** na página de **receitas**.

3. **Sem total geral de ganhos** — Os cards mostram total por grupo, mas não há um grand total de todos os ganhos combinados destacado em lugar algum.

4. **"Empréstimos" aparecem com R$ 0** — Se não houver empréstimos relevantes, o card aparece com R$ 0 e o item "pendente". Deveria ser filtrado ou omitido.

5. **Badge "recebido" / "pendente" tem baixo contraste** — `checkPending` usa `rgba(255,255,255,0.3)` como cor. Em fundo escuro, quase invisível.

6. **Sem botão de ação** — Não há como adicionar uma renda, marcar como recebido, ou editar. Página totalmente read-only sem CTA.

7. **Sem separação visual entre Cenários e Fontes** — O bloco de cenários (summary do mês) e o bloco de fontes de renda são semanticamente diferentes mas visualmente tratados da mesma forma (mesmos cards, mesmo espaçamento).

---

## 4. `/finance/analytics` — Análises

### Layout atual (de cima para baixo)

```
┌─ ModuleHeader ─────────────────────────────────────────────────────┐
│  [← Hub] (oculto)              Análises          [spacer]          │
└────────────────────────────────────────────────────────────────────┘

┌─ Header ───────────────────────────────────────────────────────────┐
│  Análises  (h1)                            [sem botão de ação]      │
│  maio de 2026                                                       │
└────────────────────────────────────────────────────────────────────┘

┌─ chartsGrid: 2×2 ──────────────────────────────────────────────────┐
│                                                                      │
│  ┌── GASTOS POR GRUPO ──┐  ┌── VARIÁVEIS — PREV. VS REAL. ──────┐ │
│  │  [Donut chart]       │  │  [Bar chart]                         │ │
│  │   ╭─────╮            │  │   ▌  ▌                               │ │
│  │   │TOTAL│            │  │   ▌  ▌  ▌  ▌                        │ │
│  │   │R$8k │            │  │   ▌  ▌  ▌  ▌  ▌  ▌                 │ │
│  │   ╰─────╯            │  │ Merc Com  Out Pito                   │ │
│  │  ● Casa  ● Pessoal   │  │  ■ Previsto  ■ Realizado             │ │
│  │  ● Outros            │  │                                       │ │
│  │  height: 260px       │  │  height: 260px + margin-bottom: 44px │ │
│  └──────────────────────┘  └───────────────────────────────────────┘│
│                                                                      │
│  ┌── EVOLUÇÃO DA POUPANÇA ┐  ┌── CENÁRIOS — GANHO VS GASTO ─────┐ │
│  │  [Area chart]          │  │  [Bar chart]                       │ │
│  │  ╱─────╱               │  │   ██  ██                           │ │
│  │ ╱      ╲  gradient     │  │   ██  ██                           │ │
│  │╱        ╲ verde        │  │  CLT  Completo                     │ │
│  │                        │  │  ■ Ganho  ■ Gastos                 │ │
│  │ jul'25  ago'25  set... │  │  CLT: -R$946  Completo: -R$189     │ │
│  │ ● Atingido ○ Pendente  │  │                                     │ │
│  │  height: 240px         │  │  height: 220px                     │ │
│  └────────────────────────┘  └────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### Problemas identificados

1. **Alturas inconsistentes entre cards** — Os 4 gráficos têm heights de `260 / 260 / 240 / 220px`. Com padding e margens internos diferentes, os cards do grid ficam com alturas desiguais, criando grid quebrado visualmente.

2. **Área chart tem margem excessiva no fundo** — `margin={{ bottom: 44 }}` para acomodar os labels rotacionados (-35°), mas isso devora ~18% da altura real do gráfico.

3. **Labels do eixo X cortados** — Os rótulos girados em -35° nos gráficos de barra ficam cortados na borda inferior dos cards, especialmente no card 2 (Variáveis).

4. **Card 4 (Cenários) triplica dados já visíveis** — Os cenários CLT/Completo com saldo já aparecem em Overview e Income. O gráfico de barras "Ganho vs Gasto" não adiciona informação nova.

5. **Gráfico de donut: legenda pode transbordar** — Se houver 5+ grupos de gastos, a legenda do PieChart estoura o card ou fica ilegível (fonte 11px, sem wrapping controlado).

6. **Sem empty state nos gráficos** — Se `donutData` ou `varData` tiver 0 itens, o recharts renderiza um gráfico vazio sem mensagem. Parece bug ao invés de "sem dados".

7. **Area chart (Poupança)**: dots coloridos indicam atingido/pendente, mas a legenda está posicionada abaixo do gráfico dentro do mesmo card — a leitura não é intuitiva. Muitos usuários não vão associar a cor dos pontos à legenda sem instrução.

8. **Dois estados de loading/error duplicam `<Navigation />`** — No early return de loading e error, o componente renderiza `<Navigation />` separado do `<Navigation />` que seria no render normal. Não causa bug visível, mas é um pattern incorreto.

9. **Página é somente leitura, sem filtros** — Não há forma de filtrar por período (mês, trimestre, ano) nos gráficos. Todos os dados são do mês corrente fixo.

---

## 5. `/finance/history` — Histórico de Gastos

### Layout atual (de cima para baixo)

```
┌─ ModuleHeader ─────────────────────────────────────────────────────┐
│  [← Hub] (oculto)              Histórico          [spacer]         │
└────────────────────────────────────────────────────────────────────┘

┌─ Header ───────────────────────────────────────────────────────────┐
│  Histórico de Gastos  (h1)          Total registrado               │
│  Gastos variáveis por dia           R$ 1.247,80  (vermelho)        │
└────────────────────────────────────────────────────────────────────┘

┌─ Search bar ───────────────────────────────────────────────────────┐
│  🔍  Filtrar por categoria...                                   [×] │
└────────────────────────────────────────────────────────────────────┘

─── HOJE ────────────────────────────────────── R$ 120,00 (vermelho)

  ┌─────────────────────────────────────────────────────────────────┐
  │  Mercado                                       R$ 75,00         │
  └─────────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────────┐
  │  Comida                                        R$ 45,00         │
  └─────────────────────────────────────────────────────────────────┘

─── 09 MAI 2026 ──────────────────────────────── R$ 210,00 (vermelho)

  ┌─────────────────────────────────────────────────────────────────┐
  │  Mercado                                       R$ 150,00        │
  └─────────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────────┐
  │  Pito                                          R$ 60,00         │
  └─────────────────────────────────────────────────────────────────┘

─── 07 MAI 2026 ──────────────────────────────── R$ 95,00 (vermelho)

  ... (continua para cada dia com dados)
```

### Problemas identificados

1. **Tudo em vermelho** — Categoria, valor diário total, valor de cada entrada, grand total — todos em `#ef4444`. A página inteira é vermelha. Gera ansiedade visual sem motivo; uma escala seria mais útil.

2. **"Total registrado" sem contexto de período** — O número no header soma TODOS os dias disponíveis na planilha (pode ser vários meses). Não há indicação de a qual período se refere.

3. **Sem filtro por período** — Não há forma de ver "só maio", "só esta semana" ou "últimos 30 dias". A página mostra todo o histórico disponível de uma vez, que pode ser muito longo.

4. **Sem aggregação por categoria** — O usuário não consegue ver "no total gastei R$ X em Mercado este mês". Para isso teria que somar visualmente linha por linha.

5. **Search só por categoria, não por data** — Filtrar por "Mercado" mostra todos os dias em que houve gasto em Mercado. Não é possível buscar por data.

6. **Padding inconsistente** — Search bar tem `padding: "0 28px 16px"` via inline style. O conteúdo abaixo tem `padding: "0 28px 80px"`. Funciona, mas mistura inline styles e CSS.

7. **Sem ícones ou cores por categoria** — "Mercado", "Comida", "Outros", "Pito" são todas linhas idênticas em cor e formato. Nenhuma diferenciação visual entre categorias.

8. **Sem totais por categoria no cabeçalho** — Seria útil ter um mini-summary: "Mercado: R$ X | Comida: R$ Y | Pito: R$ Z" para o período visível.

9. **Sem empty state contexualizado** — Se a planilha não tiver dados, aparece apenas texto simples sem ação sugerida.

---

## Problemas Transversais (afetam todas as sub-páginas)

| # | Problema | Páginas afetadas |
|---|---|---|
| 1 | **Sem sideCol (painel lateral)** — Área direita (~320px) fica sempre vazia no desktop. As páginas antigas tinham summary lateral. | Todas |
| 2 | **Fetch independente em cada sub-página** — Cada página faz `fetch("/api/finance")` separado. Navegar entre sub-páginas causa 5 chamadas à API da planilha. | Todas |
| 3 | **"Cenários de Balanço" aparece em 3 páginas** — Overview, Income e Analytics mostram `saldoCLT`/`saldoTudo` de formas diferentes. Dados repetidos 3×. | Overview, Income, Analytics |
| 4 | **Sem botão de ação em 4 das 5 páginas** — Só Expenses tem "+ Registrar". Overview, Income, Analytics, History são completamente passivas. | Overview, Income, Analytics, History |
| 5 | **Todas as sub-páginas têm `h1` + `p` (mês)** com mesma estrutura mas nenhuma usa o `sideCol`. O layout é coluna única estreita no espaço onde caberia dois painéis. | Todas |
| 6 | **Navigation duplicada em estados de loading** — Em `analytics/page.js`, o early return de loading/error renderiza `<Navigation />` sem garantir que não haverá um segundo render. | Analytics |
| 7 | **Sem breadcrumb ou indicador de sub-página ativa** — O ModuleHeader mostra o título da sub-página mas não há indicação visual de que "Gastos" é uma sub-seção de "Financeiro". | Todas |

---

## Prioridades de correção sugeridas

### Alta prioridade
- Eliminar a repetição de "Cenários de Balanço" (Overview + Income são quase idênticas)
- Adicionar filtro de período em History + agregar por categoria
- Corrigir a paleta de cores de History (não tudo vermelho)
- Substituir o double CTA em Expenses (dois "Registrar" para o mesmo modal)

### Média prioridade
- Adicionar sideCol com resumo persistente (balanço do mês) em todas as sub-páginas
- Unificar fetch em um context/hook compartilhado para evitar 5 chamadas
- Padronizar alturas dos charts em Analytics
- Melhorar legibilidade do "hoje: R$ X" nos cards de Variáveis

### Baixa prioridade
- Converter estilos inline do modal para CSS module
- Adicionar empty states nos gráficos recharts
- Adicionar totais por categoria no History
- Refinar label dupla no savingsHero da Overview
