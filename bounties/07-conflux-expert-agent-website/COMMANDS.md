## First Time Setup 

### Using Docker (Recommended)

`Note: Keep 3 env files, basically for backend, frontend, root of repo in case if you are using dockerhub images (i.e docker-compose.prod.yml) and if you are building images locally then make sure to clone the mcp-server outside of repo of conflux expert agent and keep at its root one .env file, make sure to check each .env.example because docker container may fail to start if something is missing`

#### Using Docker Images from dockerhub (Recommended)
This is recommended because you do not require to clone mcp repo just make sure that you have the correct env files in place as mentioned above.
- Be at root of repo
- Run all below commands from there 
- 
```bash
docker compose -f docker-compose.prod.yml up -d
```

#### Building Images Locally
- Be at root of repo
- Run all below commands from there

```bash
docker compose -f docker-compose.yml up -d
```


### Manual

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
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

`Note: Assuming here that you already have cloned the mcp-server for conflux and set it up`

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
