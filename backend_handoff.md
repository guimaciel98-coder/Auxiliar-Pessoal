# Backend Handoff: Criação Rápida de Tarefas (Quick Add)

Olá, **Claude Code**! O Front-end do *Daily App* agora possui um modal de Criação Rápida de Tarefas (Quick Add) que permite configurar parâmetros como nome da tarefa, projeto, cliente/marca, data/hora e opções específicas de recorrência.

A sua missão é implementar a rota de backend `POST /api/tasks/create/route.js` para receber esses dados e realizar a criação correta no ClickUp, além de contornar as limitações de recorrência da API.

## Especificação do Endpoint

**Endpoint:** `POST /api/tasks/create`
**Content-Type:** `application/json`

### Exemplo de Payload Enviado pelo Front-end:
```json
{
  "title": "Revisar contrato",
  "project": "vca", 
  "subClient": "37fec3a3-b0eb-4ecb-99df-e493e87fc4cf",
  "dueDate": "2026-05-02",
  "time": "14:30",
  "recurrence": "daily",
  "triggerOnComplete": true,
  "repeatForever": true
}
```

### Detalhamento dos Campos do Payload:
- `title` (String): Nome da tarefa digitado pelo usuário.
- `project` (String): `"pessoal"`, `"vca"` ou `"pdv"`. Você deverá mapear isso para o `list_id` correspondente do ClickUp (utilizando a constante `LIST_IDS` que já existe nos seus arquivos ou configurando as listas corretas).
- `subClient` (String): Se o projeto for VCA ou PDV, este campo conterá o ID do Custom Field (cfValue) do cliente/marca para ser associado na tarefa no ClickUp.
- `dueDate` (String - YYYY-MM-DD): Data de vencimento selecionada. 
- `time` (String - HH:MM): Opcional. Horário específico da tarefa. Se preenchido, você deve combinar com o `dueDate` para gerar o `due_date` timestamp (UTC) exato para o ClickUp.
- `recurrence` (String): `"none"`, `"daily"`, `"weekdays"`, `"weekly"` ou `"monthly"`.
- `triggerOnComplete` (Boolean): Se `true`, a recorrência no ClickUp deve ser configurada com "Ao alterar status: Concluída".
- `repeatForever` (Boolean): Se `true`, a recorrência deve se repetir infinitamente.

## O Desafio da Recorrência no ClickUp

Como a API pública v2 do ClickUp não documenta a criação oficial de tarefas com campos complexos de recorrência (recurrence schedule), você tem algumas opções arquiteturais para resolver isso:

1. **Uso de Tarefas "Template":** Se houver tarefas template já com a recorrência criada no ClickUp, a API de duplicar tarefa ou de criar via template pode ser usada.
2. **Reverse-Engineering:** Se você souber o payload oculto que o cliente web usa.
3. **Automações nativas:** A sua API aplica uma tag que dispara a automação de recorrência no ClickUp.

Implemente a lógica que transforma esse Payload JSON em uma requisição válida para a API do ClickUp (`https://api.clickup.com/api/v2/list/{list_id}/task`) utilizando o token de ambiente `process.env.CLICKUP_API_KEY`.
