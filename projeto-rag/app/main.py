from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import create_db_and_tables
from app.api import auth, fines, stats, chat, users, attendance, notifications


app = FastAPI(title="Évora Andebol Clube API", version="1.0.0")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(fines.router)
app.include_router(stats.router)
app.include_router(chat.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "Évora Andebol Clube API"}