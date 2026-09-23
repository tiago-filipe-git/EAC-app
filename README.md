<div align="center">

# 🏐 Évora Andebol Clube — App (ENG VERSION)

**Fines and attendance management app for Évora Andebol Clube (handball club).**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-AI-FF6B6B)](https://langchain-ai.github.io/langgraph/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

[Demo](https://evora-andebol.netlify.app) · [API](https://evora-andebol-api.onrender.com/docs) · [Report an issue](https://github.com/tiago-filipe-git/EAC-app/issues)

</div>

---

## 📖 About the project

**EAC App** is an internal application for **Évora Andebol Clube** that lets you:

- 💰 **Manage fines** — apply, edit, mark as paid, bulk delete
- 📋 **Track attendance** — training sessions, late arrivals, justified and unjustified absences
- 📊 **View statistics** — attendance rankings, monthly trends, top debtors
- 🤖 **Talk to an AI assistant** — apply fines, record attendance or query data using natural language
- 📱 **Install as an app** — works as a PWA on Android, iOS and desktop

The app was designed around the **club's day-to-day life**: fast to use on a phone, with automations that save time for the coaching staff and the players' union.

---

## ✨ Features

### 💰 Fines Management

- 31 fine types based on the official club regulations (training, match, general)
- Automatic amount calculation (fixed, per minute, per item, progressive)
- Automatic fines for unjustified absences or lateness
- Late payment penalty (+€0.50/day after the 1st of the following month)
- "Pé de meia" (nest egg) — accumulated fund built from paid fines
- Rankings: top debtors, most fined, highest accumulated amount
- Filters by category, period, status and text search

### 📋 Attendance

- Interactive calendar with colour intensity based on attendance %
- Day drill-down (who attended, who was absent)
- Top attendees and top absentees
- Lateness tracking in minutes
- Delete a whole training session (with automatic backup)

### 🤖 AI Assistant

- Natural-language chat
- 25+ tools (tool-calling with LangGraph)
- Role-based context (player, coaching staff, union, admin)
- Compound commands: *"record today's training: everyone present except Zé, and fine him for unjustified absence"*

### 👥 User Management

- Public sign-up (new users start as players)
- Admin assigns roles (union, coaching staff, admin)
- Delete users with cascading data removal + automatic backup

---

## 📸 Screenshots

<div align="center">

| Dashboard | Fines | Attendance |
|---|---|---|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Fines](docs/screenshots/02-multas.png) | ![Attendance](docs/screenshots/04-presencas.png) |

| Record training | AI Assistant | New fine |
|---|---|---|
| ![Record](docs/screenshots/05-marcar.png) | ![Assistant](docs/screenshots/07-assistente.png) | ![New Fine](docs/screenshots/08-nova-multa.png) |

</div>

---

## 🏗️ Architecture

```text
┌──────────────────────┐
│  Frontend (Netlify)  │   React + TypeScript + Tailwind + PWA
│    evora-andebol     │
│    .netlify.app      │
└──────────┬───────────┘
           │ HTTPS + JWT
           ▼
┌──────────────────────┐
│   Backend (Render)   │   FastAPI + SQLModel + LangGraph
│  evora-andebol-api   │
│    .onrender.com     │
└──────────┬───────────┘
           │
           ├──► 🗄️ Turso (distributed SQLite)
           └──► 🤖 Groq (LLM)
```

### Tech stack

**Frontend**

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- Axios + SSE (for streaming chat)
- PWA (installable on Android, iOS and desktop)
- Lucide Icons

**Backend**

- FastAPI + Uvicorn
- SQLModel (SQLAlchemy + Pydantic)
- JWT (python-jose) + bcrypt
- LangGraph + LangChain (tool-calling)
- Groq (LLM `openai/gpt-oss-120b`)

**Infrastructure**

- Frontend → Netlify
- Backend → Render
- Database → Turso
- Code → GitHub

---

## 📂 Project structure

```text
EAC-app/
├── projeto-rag/              # Backend (FastAPI)
│   ├── app/
│   │   ├── api/              # HTTP endpoints
│   │   ├── services/         # Business logic
│   │   ├── db/               # Models and database
│   │   ├── core/             # Auth, permissions
│   │   ├── graph/            # LangGraph + tools
│   │   └── main.py
│   ├── qa/                   # Manual tests and scripts
│   └── requirements.txt
│
├── evora-andebol-app/        # Frontend (React)
│   ├── src/
│   │   ├── pages/            # Screens
│   │   ├── components/       # Reusable components
│   │   ├── context/          # AuthContext
│   │   ├── lib/              # API client, helpers
│   │   └── main.tsx
│   ├── public/
│   └── vite.config.ts
│
├── docs/
│   └── screenshots/          # README images
│
├── start_all.cmd             # Start everything (Windows)
├── start_backend.cmd
└── start_frontend.cmd
```

---

## 🚀 Running locally

### Prerequisites

- Python 3.12+
- Node.js 20+
- A [Groq](https://console.groq.com/keys) API key
- *(Optional)* A [Turso](https://turso.tech) account for a cloud database

### Backend

```bash
cd projeto-rag

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and fill in GROQ_API_KEY

# Run
uvicorn app.main:app --reload
```

The backend runs at `http://127.0.0.1:8000` (Swagger UI at `/docs`).

### Frontend

```bash
cd evora-andebol-app
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Database seed

```bash
cd projeto-rag
python -m app.db.seed
```

Creates the admin user and the 31 fine types.

---

## 🔐 Authentication

- Login with username or phone number
- JWT with a 1-week expiry
- Roles: `jogador` (player), `equipa_tecnica` (coaching staff), `sindicato` (union), `admin`
- Public sign-up always creates users with `role=jogador`

---

## 🤖 How the AI works

The app uses **LangGraph** to orchestrate an agent with tool-calling. The user writes in natural language and the LLM decides which functions to call.

Examples (the assistant understands Portuguese):

```text
"aplica multa por falta injustificada ao Zé Atleta"
# apply a fine for unjustified absence to Zé Atleta

"marca o treino de hoje: todos presentes menos o Zé"
# record today's training: everyone present except Zé

"quantas multas pendentes tem o Pedro?"
# how many pending fines does Pedro have?

"apaga o treino de 22 de setembro"
# delete the training session of September 22

"notifica os devedores que têm multas em atraso"
# notify debtors who have overdue fines
```

The agent has access to 25+ tools covering fines, attendance, notifications and users. Permissions are validated per role.

---

## 📱 Install as an app

### Android

1. Open the site in Chrome
2. Menu → **Install app**

### iOS

1. Open the site in Safari
2. **Share** button → **Add to Home Screen**
3. Enable **"Open as Web App"**

### Desktop (Chrome/Edge)

- Click the install icon in the address bar

---

## 🛠️ Environment variables

### Backend (`projeto-rag/.env`)

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq API key (required) |
| `SECRET_KEY` | Key used to sign JWTs (required in production) |
| `TURSO_URL` | Turso database URL (optional — falls back to local SQLite if empty) |
| `TURSO_TOKEN` | Turso access token (required if `TURSO_URL` is set) |

### Frontend (`evora-andebol-app/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (e.g. `https://evora-andebol-api.onrender.com`) |

---

## 📄 License

MIT — see [LICENSE](LICENSE).

> **In short:** you can freely use, copy, modify and distribute this project, even for commercial purposes. You just need to keep the original copyright notice.

---

## 👤 Author

**Tiago Filipe**

- GitHub: [@tiago-filipe-git](https://github.com/tiago-filipe-git)
- LinkedIn: [tiago-filipe-803674345](https://www.linkedin.com/in/tiago-filipe-803674345/)

---

## ⚠️ Disclaimer

This project was built for Évora Andebol Clube as a practical case study. It is not a commercial product and has no official support.

If you'd like to build something similar for your own team, feel free to take the code and adapt it.

---

<div align="center">

Made with 💛 for Évora Andebol Clube

</div>


<div align="center">

# 🏐 Évora Andebol Clube — App (VERSÃO PT)

**App de gestão de multas e assiduidade para o Évora Andebol Clube.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-AI-FF6B6B)](https://langchain-ai.github.io/langgraph/)
[![PWA](https://img.shields.io/badge/PWA-instal%C3%A1vel-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

[Demo](https://evora-andebol.netlify.app) · [API](https://evora-andebol-api.onrender.com/docs) · [Reportar problema](https://github.com/tiago-filipe-git/EAC-app/issues)

</div>

---

## 📖 Sobre o projeto

O **EAC App** é uma aplicação interna para o **Évora Andebol Clube** que permite:

- 💰 **Gerir multas** — aplicar, editar, marcar como pago, apagar em massa
- 📋 **Marcar presenças** — treinos, atrasos, faltas justificadas e injustificadas
- 📊 **Consultar estatísticas** — rankings de assiduidade, evolução mensal, top devedores
- 🤖 **Interagir com IA** — aplicar multas, marcar presenças ou consultar dados através de linguagem natural
- 📱 **Instalar como app** — funciona como PWA em Android, iOS e desktop

A app foi desenhada a pensar no **dia a dia do clube**: rápido de usar no telemóvel, com automações que poupam tempo à equipa técnica e ao sindicato.

---

## ✨ Funcionalidades

### 💰 Gestão de Multas

- 31 tipos de multa baseados no regulamento oficial (treino, jogo, gerais)
- Cálculo automático de valores (fixo, por minuto, por peça, progressivo)
- Multas automáticas por falta injustificada ou atraso
- Atraso de pagamento (+0,50 €/dia após o dia 1 do mês seguinte)
- "Pé de meia" — fundo acumulado das multas pagas
- Rankings: top devedores, top multados, top valor acumulado
- Filtros por categoria, período, estado e pesquisa por texto

### 📋 Assiduidade

- Calendário interativo com intensidade de cor por % de presenças
- Drill-down do dia (quem esteve, quem faltou)
- Top assíduos e top faltosos
- Marcação com atraso em minutos
- Apagar treino inteiro (com backup automático)

### 🤖 Assistente IA

- Chat em linguagem natural
- 25+ ferramentas (tool-calling com LangGraph)
- Contexto por role (jogador, equipa técnica, sindicato, admin)
- Comandos compostos: *"marca o treino de hoje: todos presentes menos o Zé, e aplica-lhe multa por falta injustificada"*

### 👥 Gestão de Users

- Registo público (novos users ficam como jogador)
- Admin atribui roles (sindicato, equipa técnica, admin)
- Apagar users com cascata nos dados + backup automático

---

## 📸 Screenshots

<div align="center">

| Dashboard | Multas | Presenças |
|---|---|---|
| ![Dashboard](docs/screenshots/01-dashboard.png) | ![Multas](docs/screenshots/02-multas.png) | ![Presenças](docs/screenshots/04-presencas.png) |

| Marcar treino | Assistente IA | Nova multa |
|---|---|---|
| ![Marcar](docs/screenshots/05-marcar.png) | ![Assistente](docs/screenshots/07-assistente.png) | ![Nova Multa](docs/screenshots/08-nova-multa.png) |

</div>

---

## 🏗️ Arquitetura

```text
┌──────────────────────┐
│  Frontend (Netlify)  │   React + TypeScript + Tailwind + PWA
│    evora-andebol     │
│    .netlify.app      │
└──────────┬───────────┘
           │ HTTPS + JWT
           ▼
┌──────────────────────┐
│   Backend (Render)   │   FastAPI + SQLModel + LangGraph
│  evora-andebol-api   │
│    .onrender.com     │
└──────────┬───────────┘
           │
           ├──► 🗄️ Turso (SQLite distribuído)
           └──► 🤖 Groq (LLM)
```

### Stack técnico

**Frontend**

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- Axios + SSE (para o chat em streaming)
- PWA (instalável em Android, iOS e desktop)
- Lucide Icons

**Backend**

- FastAPI + Uvicorn
- SQLModel (SQLAlchemy + Pydantic)
- JWT (python-jose) + bcrypt
- LangGraph + LangChain (tool-calling)
- Groq (LLM `openai/gpt-oss-120b`)

**Infra**

- Frontend → Netlify
- Backend → Render
- Base de dados → Turso
- Código → GitHub

---

## 📂 Estrutura do projeto

```text
EAC-app/
├── projeto-rag/              # Backend (FastAPI)
│   ├── app/
│   │   ├── api/              # Endpoints HTTP
│   │   ├── services/         # Lógica de negócio
│   │   ├── db/               # Modelos e database
│   │   ├── core/             # Auth, permissões
│   │   ├── graph/            # LangGraph + tools
│   │   └── main.py
│   ├── qa/                   # Testes manuais e scripts
│   └── requirements.txt
│
├── evora-andebol-app/        # Frontend (React)
│   ├── src/
│   │   ├── pages/            # Ecrãs
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── context/          # AuthContext
│   │   ├── lib/              # API client, helpers
│   │   └── main.tsx
│   ├── public/
│   └── vite.config.ts
│
├── docs/
│   └── screenshots/          # Imagens do README
│
├── start_all.cmd             # Arrancar tudo (Windows)
├── start_backend.cmd
└── start_frontend.cmd
```

---

## 🚀 Como correr localmente

### Pré-requisitos

- Python 3.12+
- Node.js 20+
- Chave de API do [Groq](https://console.groq.com/keys)
- *(Opcional)* Conta [Turso](https://turso.tech) para DB em cloud

### Backend

```bash
cd projeto-rag

# Criar e ativar venv
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env e preencher GROQ_API_KEY

# Correr
uvicorn app.main:app --reload
```

O backend fica em `http://127.0.0.1:8000` (Swagger em `/docs`).

### Frontend

```bash
cd evora-andebol-app
npm install
npm run dev
```

O frontend fica em `http://localhost:5173`.

### Seed da base de dados

```bash
cd projeto-rag
python -m app.db.seed
```

Cria o user admin e os 31 tipos de multa.

---

## 🔐 Autenticação

- Login por username ou telefone
- JWT com expiração de 1 semana
- Roles: `jogador`, `equipa_tecnica`, `sindicato`, `admin`
- Registo público cria sempre com `role=jogador`

---

## 🤖 Como funciona a IA

A app usa **LangGraph** para orquestrar um agente com tool-calling. O utilizador escreve em linguagem natural e o LLM decide quais funções chamar.

Exemplos:

```text
"aplica multa por falta injustificada ao Zé Atleta"
"marca o treino de hoje: todos presentes menos o Zé"
"quantas multas pendentes tem o Pedro?"
"apaga o treino de 22 de setembro"
"notifica os devedores que têm multas em atraso"
```

O agente tem acesso a 25+ tools que cobrem multas, presenças, notificações e users. As permissões são validadas por role.

---

## 📱 Instalar como app

### Android

1. Abre o site no Chrome
2. Menu → **Instalar app**

### iOS

1. Abre o site no Safari
2. Botão **Partilhar** → **Adicionar ao Ecrã Principal**
3. Ativa **"Abrir como App Web"**

### Desktop (Chrome/Edge)

- Clica no ícone de instalar na barra de endereço

---

## 🛠️ Variáveis de ambiente

### Backend (`projeto-rag/.env`)

| Variável | Descrição |
|---|---|
| `GROQ_API_KEY` | Chave API do Groq (obrigatória) |
| `SECRET_KEY` | Chave para assinar JWT (obrigatória em produção) |
| `TURSO_URL` | URL da DB Turso (opcional — usa SQLite local se vazio) |
| `TURSO_TOKEN` | Token de acesso à Turso (obrigatório se `TURSO_URL` definido) |

### Frontend (`evora-andebol-app/.env`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL do backend (ex: `https://evora-andebol-api.onrender.com`) |

---

## 📄 License

MIT — vê [LICENSE](LICENSE).

> **Resumindo:** podes usar, copiar, modificar e distribuir livremente, mesmo para fins comerciais. Só tens de manter o aviso de copyright original.

---

## 👤 Autor

**Tiago Filipe**

- GitHub: [@tiago-filipe-git](https://github.com/tiago-filipe-git)
- LinkedIn: [tiago-filipe-803674345](https://www.linkedin.com/in/tiago-filipe-803674345/)

---

## ⚠️ Aviso

Este projeto foi feito para o Évora Andebol Clube como caso prático. Não é um produto comercial nem tem suporte oficial.

Se quiseres fazer algo semelhante para a tua equipa, fica à vontade para pegar no código e adaptar.

---

<div align="center">

Feito com 💛 para o Évora Andebol Clube

</div>
