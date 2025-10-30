from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.machines import reload_registry
from .routers import analyze, export, machines

app = FastAPI(title="Machine Registry API", version="0.1.0")

# --- CORS: allow your Expo web dev server(s) ---
# Adjust this list as needed (e.g., add LAN IP if testing from a phone)
ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # use ["*"] for quick local testing (not with credentials in prod)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.on_event("startup")
def _load_registry() -> None:
    reload_registry()

app.include_router(machines.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
