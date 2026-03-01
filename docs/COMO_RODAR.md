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

O bot passa a responder no Telegram. Ele salva ideias no Obsidian, sugere novas áreas/interesses e pode criar tarefas no planejamento empresarial.

---

## 3. Ordem recomendada

1. **Inicie o backend do Obsidian** → `npm run dev` em `Obsidian_premium/backend`
2. **Inicie o bot** → `python -m assistant.bot` em `bot - secretaria da minha vida`
3. (Opcional) **Inicie o frontend** → `npm run dev` em `Obsidian_premium/frontend` para usar a interface web

O bot precisa que o backend esteja no ar para salvar ideias e tarefas. O frontend é opcional.

---

## 4. FFmpeg (transcrição de áudio)

Para mensagens de voz funcionarem, instale o FFmpeg:

- **Windows**: `winget install ffmpeg` (depois feche e abra o terminal)
- **Linux/macOS**: `apt install ffmpeg` ou `brew install ffmpeg`
