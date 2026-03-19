# Serverless Deployment Quick Reference

## Backend is NOW Serverless-Ready!

The backend uses **Mangum adapter** to wrap FastAPI for serverless platforms while maintaining local development compatibility.

---

## Architecture

```
FastAPI App → Mangum Wrapper → AWS Lambda / Cloud Run
             ↓
       Local Development: uvicorn main:app
       Production: handler(event, context)
```

**Key file changes:**

- `backend/main.py` - Added `handler = Mangum(app)` for serverless
- `backend/serverless.yml` - AWS Lambda config (Serverless Framework)
- `backend/template.yaml` - AWS SAM template (local testing)
- `backend/Dockerfile` - Container image for Cloud Run
- `backend/README.md` - Comprehensive deployment guide

---

## Local Development (No Changes!)

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Works exactly the same as before! The serverless wrapper doesn't affect local development.

---

## Serverless Deployment Options

### AWS Lambda (Serverless Framework)

**Install:**

```bash
npm install -g serverless
```

**Deploy:**

```bash
cd backend
serverless deploy
```

**Result:**

- API Gateway endpoint
- Lambda function
- Auto-scales to zero
- Pay per request

**Config:** `backend/serverless.yml`

---

### AWS Lambda (SAM - for local testing)

**Install:**

```bash
# Windows
choco install aws-sam-cli

# Mac
brew install aws-sam-cli
```

**Test locally:**

```bash
cd backend
sam build
sam local start-api --port 8000
```

**Deploy:**

```bash
sam deploy --guided
```

**Config:** `backend/template.yaml`

---

### Google Cloud Run

**Deploy:**

```bash
cd backend
gcloud run deploy conflux-expert \
  --region us-central1 \
  --allow-unauthenticated
```

**Config:** `backend/Dockerfile`

---

### Railway / Render (Container)

**Railway:**

```bash
railway up
```

**Render:**

- Connect GitHub repo
- Select `backend` directory
- Choose Docker deployment
- Auto-deploy on push

---

## Testing Serverless Locally

### Option 1: AWS SAM (Recommended)

```bash
cd backend
sam build
sam local start-api --port 8000

# Test
curl http://localhost:8000/
```

### Option 2: Docker

```bash
cd backend
docker build -t backend .
docker run -p 8000:8000 --env-file .env backend

# Test
curl http://localhost:8000/
```

### Option 3: Regular uvicorn

```bash
cd backend
uvicorn main:app --reload
```

---
