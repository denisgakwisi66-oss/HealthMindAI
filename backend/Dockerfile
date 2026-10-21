FROM python:3.12-slim

WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/backend/
COPY css/ /app/css/
COPY js/ /app/js/
COPY *.html /app/
COPY favicon.svg image-hero.jpg manifest.json service-worker.js /app/

RUN useradd --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://localhost:' + os.environ.get('PORT', '8000') + '/api/health', timeout=3)"]

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
