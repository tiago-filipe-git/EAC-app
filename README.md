<div align="center">

# 🏐 Évora Andebol Clube — App

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
