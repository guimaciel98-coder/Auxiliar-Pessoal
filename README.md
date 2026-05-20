# Guida Daily

App de relatório diário conectado ao ClickUp.

## Setup local

```bash
npm install
```

Edite o arquivo `.env.local` e cole seu token:
```
CLICKUP_API_KEY=pk_xxxxxxxx
```

Rode o app:
```bash
npm run dev
```

Acesse: http://localhost:3000

## Deploy no Vercel

1. Crie uma conta em vercel.com
2. Instale o Vercel CLI:
```bash
npm install -g vercel
```
3. Na pasta do projeto, rode:
```bash
vercel
```
4. Siga as instruções (Enter em tudo)
5. No final, acesse o painel do Vercel → seu projeto → Settings → Environment Variables
6. Adicione: `CLICKUP_API_KEY` = seu token
7. Rode `vercel --prod` para republicar

Pronto — sua URL estará disponível em `https://guida-daily.vercel.app` (ou similar).
