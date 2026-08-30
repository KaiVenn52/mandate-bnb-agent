FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
WORKDIR /app/backend

RUN useradd --create-home --uid 10001 mandate \
    && chown -R mandate:mandate /app
USER mandate

CMD ["sh", "-c", "python -m uvicorn provider_service.app:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
