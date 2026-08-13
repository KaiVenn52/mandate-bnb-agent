"""Vercel ASGI entrypoint for the guarded MANDATE gateway."""

from fastapi import FastAPI

from backend.app.main import app as gateway_app


app = FastAPI(title="MANDATE API")
app.mount("/api", gateway_app)
