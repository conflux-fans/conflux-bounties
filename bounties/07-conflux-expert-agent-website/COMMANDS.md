## First Time Setup

```bash

cd backend
uv sync
cp .env.example .env

python -m scripts.sync_content

uvicorn main:app --reload

cd frontend
npm install
cp .env.example .env.local
npm run dev

# Open browser
# http://localhost:3000
```

---

## Daily Development

```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## Testing

```bash
cd backend

# All tests
pytest tests/ -v

# Specific test
pytest tests/test_benchmark.py -v -s

# Fast tests only
pytest tests/ -v -m "not slow"
```

---

## Update Content

```bash
cd backend
python -m scripts.sync_content
```

---
