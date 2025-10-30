from fastapi import FastAPI

from server.machines import reload_registry

from .routers import analyze, export, machines

app = FastAPI(title="Machine Registry API", version="0.1.0")


@app.get("/")
def read_root():
    return {"status": "ok"}


@app.on_event("startup")
def _load_registry() -> None:
    reload_registry()


app.include_router(machines.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
