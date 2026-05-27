from fastapi import FastAPI

app = FastAPI(title="FieldOps API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "FieldOps API está online e operando via Docker!"}