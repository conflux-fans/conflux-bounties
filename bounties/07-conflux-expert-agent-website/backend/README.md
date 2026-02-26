# Conflux Expert Backend

**Serverless-ready FastAPI backend** for the Conflux Expert Agent with RAG and tool calling.

## Architecture

This backend is designed to run as **serverless functions** while maintaining full compatibility with local development:

- **Local Development**: Traditional FastAPI server with uvicorn
- **Production**: AWS Lambda, Google Cloud Run, or other serverless platforms
- **Adapter**: Mangum wrapper for ASGI → AWS Lambda compatibility

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -e .
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required variables:

- `GEMINI_API_KEY` - Google Gemini API key (FREE)
- `PINECONE_API_KEY` - Pinecone API key
- `PINECONE_INDEX_NAME` - Your Pinecone index name
- `CONFLUXSCAN_API_KEY` - ConfluxScan API key
- `GITHUB_TOKEN` - GitHub personal access token

### 3. Run Locally

```bash
python main.py

uvicorn main:app --reload --port 8000

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API will be available at: **http://localhost:8000**

---

## 📁 Project Structure

```
backend/
├── main.py                    # FastAPI app + serverless handler
├── config.py                  # Configuration management
├── serverless.yml             # Serverless Framework config
├── template.yaml              # AWS SAM template
├── pyproject.toml             # Python dependencies
├── pytest.ini                 # Test configuration
├── agent/
│   └── conflux_agent.py       # RAG + tool orchestrator
├── rag/
│   ├── vector_store.py        # Pinecone integration
│   └── text_processor.py      # Text chunking
├── tools/
│   └── confluxscan_client.py  # ConfluxScan API wrapper
├── ingestion/
│   └── github_ingest.py       # Content ingestion
├── scripts/
│   └── sync_content.py        # Content sync script
└── tests/
    ├── test_benchmark.py      # Benchmark test suite
    ├── test_confluxscan_client.py
    └── test_ingestion.py
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_benchmark.py -v -s

# Run only fast tests (skip benchmarks)
pytest tests/ -v -m "not slow"

pytest tests/ -v --cov=. --cov-report=html
```

---

## 🔌 API Endpoints

### Health Check

```bash
GET /
```

### Chat with Agent

```bash
POST /api/chat
Content-Type: application/json

{
  "query": "What is Conflux?",
  "history": []
}
```

### Search Knowledge Base

```bash
POST /search
Content-Type: application/json

{
  "query": "smart contract deployment",
  "top_k": 5
}
```

### Sync Content

```bash
POST /api/sync
```

### Clear Chat History

```bash
POST /chat/clear
```

### Get Chat History

```bash
GET /chat/history
```

---

## Monitoring & Logging

### Structured Logging

All logs follow this format:

```
YYYY-MM-DD HH:MM:SS | LEVEL | MODULE | MESSAGE
```

**Log file:** `conflux_expert.log`

**View logs in real-time:**

```bash
tail -f conflux_expert.log
```

---
