"""FastAPI server for Conflux Expert backend."""

import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from agent.conflux_agent import ConfluxExpertAgent
from config import settings
from rag.vector_store import VectorStore
from tools.confluxscan_client import ConfluxScanClient, NetworkType
from tools.mcp_client import MCPClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("conflux_expert.log", mode="a"),
    ],
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Conflux Expert API",
    description="RAG-powered chat API for Conflux blockchain",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = VectorStore(
    api_key=settings.pinecone_api_key,
    index_name=settings.pinecone_index_name,
    embedding_model=settings.embedding_model,
    environment=settings.pinecone_environment,
)

confluxscan_client = ConfluxScanClient(
    api_key=settings.confluxscan_api_key, network=NetworkType.MAINNET_ESPACE
)

mcp_client = MCPClient(server_url=settings.mcp_server_url)

agent = ConfluxExpertAgent(
    vector_store=vector_store,
    confluxscan_client=confluxscan_client,
    mcp_client=mcp_client,
    model=settings.gemini_model,
    temperature=settings.temperature,
)


class ChatRequest(BaseModel):
    query: str
    history: Optional[List[dict]] = []


class ChatResponse(BaseModel):
    response: str
    citations: List[dict]
    tool_result: Optional[dict] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SyncRequest(BaseModel):
    force: bool = False


class LoginRequest(BaseModel):
    password: str


_bearer = HTTPBearer()


def _make_token() -> str:
    payload = {
        "sub": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    try:
        jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.post("/api/admin/login")
async def admin_login(body: LoginRequest):
    if body.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": _make_token()}


@app.get("/api/sources")
async def get_sources():
    """Return configured content sources."""
    import json
    import pathlib

    sources_path = pathlib.Path(__file__).parent / "sources.json"
    with open(sources_path) as f:
        return json.load(f)


@app.get("/")
async def root():
    logger.info("Health check requested")
    return {"status": "online", "service": "Conflux Expert API", "version": "1.0.0"}


@app.get("/stats")
async def get_stats():
    logger.info("Stats requested")
    stats = vector_store.get_stats()
    return {
        "vector_store": stats,
        "model": settings.gemini_model,
        "embedding_model": settings.embedding_model,
    }


@app.post("/search")
async def search_knowledge(request: SearchRequest):
    logger.info(
        f"Search request: query='{request.query[:50]}...', top_k={request.top_k}"
    )
    try:
        results = vector_store.search(query=request.query, top_k=request.top_k)
        logger.info(f"Search returned {len(results)} results")
        return {"results": results}
    except Exception as e:
        logger.error(f"Search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest):
    logger.info(f"Chat request: query='{request.query[:100]}...'")
    try:
        full_message = ""
        citations = []
        tool_result = None

        async for event in agent.chat(request.query, stream=True):
            if event["type"] == "content":
                full_message += event.get("delta", "")
            elif event["type"] == "citations":
                citations = event.get("citations", [])
            elif event["type"] == "tool_result":
                tool_result = {"tool": event["tool"], "result": event["result"]}

        logger.info(
            f"Chat response: {len(full_message)} chars, {len(citations)} citations, tool={'yes' if tool_result else 'no'}"
        )

        return {
            "response": full_message,
            "citations": citations,
            "tool_result": tool_result,
        }
    except Exception as e:
        logger.error(f"Chat failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/sync")
async def admin_sync_content(_: None = Depends(verify_admin_token)):
    logger.info("Content sync requested (authenticated)")
    try:
        from scripts.sync_content import sync_all_sources

        result = await sync_all_sources()
        logger.info(
            f"Content sync completed: {result.get('synced_count', 0)} sources synced"
        )
        return {
            "status": "success",
            "message": "Content sync completed",
            "synced_count": result.get("synced_count", 0),
            "vectors_upserted": result.get("vectors_upserted", 0),
        }
    except Exception as e:
        logger.error(f"Sync failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/clear")
async def clear_chat_history():
    agent.clear_history()
    return {"status": "cleared"}


@app.get("/chat/history")
async def get_chat_history():
    return {"history": agent.get_history()}


from mangum import Mangum

handler = Mangum(app, lifespan="off")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
