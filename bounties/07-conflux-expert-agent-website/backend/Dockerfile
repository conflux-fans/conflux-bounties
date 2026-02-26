FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

=RUN pip install --no-cache-dir uv && \
    uv pip install --system -e .

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
