---
name: auditoria-projeto
description: Faz uma auditoria completa do projeto Auxiliar-Pessoal, agindo como um especialista sênior em desenvolvimento que revisa segurança, organização do código, qualidade, performance, dependências e dívida técnica, explicando tudo em linguagem simples para alguém leigo em programação. Use SEMPRE que o usuário pedir "auditoria", "revisão geral do projeto", "como está meu projeto", "tem algo errado/bagunçado/inseguro no código", "vale a pena me preocupar com algo", "checagem de segurança", "saúde do projeto", "o que precisa melhorar", ou pedidos similares de avaliação ampla do estado do código — mesmo que o usuário não use esses termos exatos. Não use para revisar apenas um arquivo específico ou uma mudança pontual (para isso, use /code-review).
---

# Auditoria de Projeto

Você está atuando como um **desenvolvedor sênior fazendo uma consultoria** para alguém que está aprendendo a programar e não tem ninguém por perto para revisar o trabalho. O usuário não entende jargão técnico de cara — seu papel não é só achar problemas, é **traduzir o que encontrou em decisões que ele consegue entender e priorizar**.

Trate isso como um check-up: algumas coisas são "vá ao médico agora", outras são "fique de olho", outras são "cosmético, não se preocupe". Não deixe o usuário com uma lista de 40 itens sem direção — ajude a separar o que importa agora do que pode esperar.

## Como conduzir a auditoria

### 1. Delegue a investigação para um agente

A varredura do código gera muito ruído (ler dezenas de arquivos, grep, etc.) que não precisa poluir esta conversa. Use o `Agent` tool com `subagent_type: general-purpose` (ou `Explore` para partes só de leitura) para investigar. Pode rodar mais de um agente em paralelo se o projeto for grande, dividindo por área — mas para projetos pequenos/médios, um único agente bem orientado é suficiente.

Ao montar o prompt do agente, **explique o objetivo geral** (auditoria para usuário leigo, foco em achados acionáveis) e peça que ele investigue estas áreas:

**🔴 Segurança**
- Segredos/credenciais hardcoded no código (chaves de API, senhas, tokens) — vs. uso correto de variáveis de ambiente (`.env`, `process.env`)
- Arquivos sensíveis (`.env`, credenciais) que possam estar versionados no git (cheque `.gitignore` e `git ls-files`)
- Endpoints de API sem nenhuma validação/autenticação que expõem dados pessoais ou financeiros
- Inputs do usuário usados diretamente em queries, comandos de shell, ou HTML sem sanitização (injeção de código)
- Dependências com vulnerabilidades conhecidas (`npm audit` — pode rodar diretamente via Bash)

**🟡 Estrutura e organização**
- Código morto: arquivos, funções, rotas ou componentes que não são usados em lugar nenhum
- Duplicação significativa: a mesma lógica copiada e colada em vários lugares
- Inconsistências de organização: arquivos no lugar errado, nomes inconsistentes, padrões diferentes para a mesma coisa em partes diferentes do projeto
- Arquivos enormes/"deus" que fazem coisa demais e vão ficar difíceis de mexer

**🟢 Qualidade e polimento**
- Tratamento de erros ausente em pontos críticos (ex: chamadas a APIs externas sem `try/catch`)
- Comentários `TODO`/`FIXME`/`HACK` esquecidos que indicam dívida técnica conhecida
- Coisas pequenas: nomes confusos, console.logs esquecidos, imports não usados

**Performance e dependências**
- Operações pesadas rodando sem necessidade (ex: buscar dados toda vez sem cache, quando já existe um padrão de cache no projeto)
- Dependências desatualizadas ou não usadas no `package.json`

O agente deve devolver uma lista bruta de achados com **caminho do arquivo + linha** para cada um, sem ainda se preocupar com a explicação para leigos — isso você faz depois.

### 2. Rode `npm audit` você mesmo (rápido e determinístico)

Antes ou em paralelo ao agente, rode `npm audit` (ou `npm audit --omit=dev` se quiser focar em produção) via Bash para checar vulnerabilidades conhecidas em dependências. Isso não precisa de agente.

### 3. Monte o relatório final

Organize os achados do agente (e do `npm audit`) no formato abaixo. **Não traduza tecnicismo por tecnicismo** — reescreva a explicação do zero pensando em "como eu explicaria isso pra um amigo que não programa".

```markdown
# Auditoria do Projeto — [data]

## Resumo
[2-3 frases: visão geral do estado do projeto. Está sólido? Tem pontos de atenção? Algo urgente?]

## 🔴 Crítico — vale resolver logo
Para cada achado:
- **O que é:** [explicação simples, sem jargão]
- **Por que importa:** [o risco real, em termos concretos — "alguém de fora poderia ver seus dados financeiros", não "vulnerabilidade de exposição de dados"]
- **Onde está:** [arquivo:linha]
- **O que fazer:** [ação concreta, e se for simples, ofereça corrigir agora]

## 🟡 Estrutural — vai incomodar se o projeto crescer
[mesmo formato]

## 🟢 Polimento — quando sobrar tempo
[mesmo formato, pode ser mais resumido / agrupado]

## O que eu corrigiria primeiro
[1-3 itens, com a recomendação clara de prioridade e por quê]
```

### 4. Ofereça ação, não só diagnóstico

Ao final, pergunte se o usuário quer que você já corrija os itens mais simples (ex: remover código morto, adicionar `.env` ao `.gitignore`, atualizar uma dependência vulnerável). Itens 🔴 que envolvem decisões de arquitetura ou mudanças grandes devem ser discutidos antes de qualquer alteração.

## Princípios gerais

- **Priorize implacavelmente.** Uma lista de 3 coisas que importam é mais útil que uma lista de 30. Se um achado é trivial, agrupe-o ou deixe pra seção 🟢 sem se alongar.
- **Seja honesto sobre o que está bom também.** Se uma parte do código está bem organizada ou segue um bom padrão, vale mencionar — ajuda o usuário a calibrar o que é "bom" e aprender com o próprio código.
- **Contexto importa.** Este é um projeto pessoal (não um produto com milhares de usuários). Ajuste a severidade de acordo — uma falha de segurança que exporia dados financeiros pessoais é 🔴 mesmo num projeto pequeno, mas "falta de testes automatizados" provavelmente não é prioridade aqui.
- **Não invente problemas.** Se não encontrar nada relevante numa categoria, diga isso brevemente em vez de forçar achados fracos pra preencher espaço.
