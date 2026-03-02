# Como rodar o projeto

Guia para colocar o **Obsidian_premium** e o **Bot Secretaria** em funcionamento.

---

## 1. Obsidian_premium (Backend + Frontend)

O Obsidian_premium tem backend (Node.js) e frontend (Vite/React). O bot depende apenas do **backend**.

### Backend

```bash
cd Obsidian_premium/backend
npm install
npm run dev
```

- Servidor sobe em `http://localhost:4000`
- Banco SQLite criado em `data.sqlite` (na pasta do backend)
- Variável opcional: `PORT` (padrão: 4000), `SQLITE_PATH` (caminho do banco)

### Frontend (para usar a interface web)

```bash
cd Obsidian_premium/frontend
npm install
npm run dev
```

- Interface em `http://localhost:5173` (ou porta indicada pelo Vite)
- O proxy envia `/api` para `http://localhost:4000`

---

## 2. Bot Secretaria (Telegram)

### Pré-requisitos

- **Python 3.10+**
- **FFmpeg** no PATH (para transcrição de áudio)
- Token do Telegram via [@BotFather](https://t.me/BotFather)
- Chave da API [OpenRouter](https://openrouter.ai)

### Instalação

```bash
cd "bot - secretaria da minha vida"
pip install -r requirements.txt
```

### Configuração (.env)

Na raiz de `bot - secretaria da minha vida`, copie `.env.example` para `.env` e preencha:

```env
TELEGRAM_BOT_TOKEN=seu_token_do_botfather
OPENROUTER_API_KEY=sua_chave_openrouter
OBSIDIAN_API_BASE_URL=http://localhost:4000
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `TELEGRAM_BOT_TOKEN` | Sim | Token do BotFather |
| `OPENROUTER_API_KEY` | Sim | Chave da API OpenRouter |
| `OBSIDIAN_API_BASE_URL` | Sim | URL do backend do Obsidian (ex.: `http://localhost:4000`) |
| `OPENROUTER_MODEL` | Não | Modelo LLM (padrão: `meta-llama/llama-3-8b-instruct`) |
teste

### Execução

```bash
cd "bot - secretaria da minha vida"
python -m assistant.bot
```

O bot passa a responder no Telegram. Ele salva ideias no Obsidian, sugere novas áreas/interesses e pode criar tarefas no planejamento empresarial e no planejamento pessoal.

---

## 3. Ordem recomendada

1. **Inicie o backend do Obsidian** → `npm run dev` em `Obsidian_premium/backend`
2. **Inicie o bot** → `python -m assistant.bot` em `bot - secretaria da minha vida`
3. (Opcional) **Inicie o frontend** → `npm run dev` em `Obsidian_premium/frontend` para usar a interface web

O bot precisa que o backend esteja no ar para salvar ideias e tarefas. O frontend é opcional.

---

## 4. Docker (produção)

Na raiz do repositório:

```bash
docker compose up -d
```

- **Backend** em `4001:4000`, **frontend** em `8813:80`, **bot** usa o mesmo backend via rede interna.
- O bot precisa do `.env` em `bot - secretaria da minha vida/.env` (não vai no Git); no servidor, crie esse arquivo com `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY` e, no compose, `OBSIDIAN_API_BASE_URL` já vem como `http://backend:4000`.

### Importante: um único stack

**Bot e painel Obsidian Premium precisam usar o mesmo backend (mesma instância, mesmo banco).**  
Se houver dois stacks (por exemplo `gestao-ideias-*` e `gest-o-de-ideias-*`), cada um terá seu próprio backend e seu próprio SQLite. O painel pode mostrar os interesses/áreas que você cadastrou em um backend, e o bot pode responder com "Pessoal - Inbox - Áreas" por estar conectado ao outro backend (só com os dados iniciais).

**Solução:** subir **apenas um** `docker compose` a partir da raiz do repo. Parar e remover o outro stack, depois:

```bash
cd ~/gest-o-de-ideias   # raiz do repositório (ajuste o caminho)
docker compose down      # se já existir algum stack deste compose
docker compose up -d     # sobe backend + frontend + bot, todos no mesmo backend
```

Assim, o painel e o bot consultam a mesma API e o mesmo SQLite; as categorias ficam unificadas.

---

## 5. FFmpeg (transcrição de áudio)

Para mensagens de voz funcionarem, instale o FFmpeg:

- **Windows**: `winget install ffmpeg` (depois feche e abra o terminal)
- **Linux/macOS**: `apt install ffmpeg` ou `brew install ffmpeg`
