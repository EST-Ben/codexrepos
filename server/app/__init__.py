from fastapi import FastAPI

app = FastAPI(title="Machine Registry API")


@app.get("/")
def read_root():
    return {"status": "ok"}
