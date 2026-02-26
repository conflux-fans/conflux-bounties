"""CLI script to sync content from GitHub and update vector store."""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from config import settings
from ingestion.github_ingest import GitHubIngestionPipeline
from rag.text_processor import TextProcessor
from rag.vector_store import VectorStore

SOURCES_FILE = ROOT / "sources.json"
CACHE_FILE = ROOT / ".fetch_cache.json"
PROGRESS_FILE = ROOT / ".upsert_progress.json"


def _sources_hash() -> str:
    return hashlib.md5(SOURCES_FILE.read_bytes()).hexdigest()[:12]


def load_cache() -> list[dict] | None:
    if not CACHE_FILE.exists():
        return None
    try:
        data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        if data.get("sources_hash") != _sources_hash():
            print("  sources.json changed — cache invalidated.")
            return None
        docs = data["documents"]
        print(f"  Loaded {len(docs)} documents from cache ({CACHE_FILE.name})")
        print("  To force a fresh GitHub fetch, delete .fetch_cache.json")
        return docs
    except Exception as e:
        print(f"  Cache read error ({e}) — will re-fetch.")
        return None


def save_cache(documents: list[dict]) -> None:
    payload = {"sources_hash": _sources_hash(), "documents": documents}
    CACHE_FILE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"  Saved {len(documents)} documents to cache ({CACHE_FILE.name})")


def clear_cache() -> None:
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
        print("  Cache cleared.")


def load_progress() -> set[int]:
    if not PROGRESS_FILE.exists():
        return set()
    try:
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        batches = set(data.get("completed_batches", []))
        if batches:
            print(f"  Found upsert progress: {len(batches)} batches already done.")
        return batches
    except Exception:
        return set()


def save_progress(completed: set[int]) -> None:
    PROGRESS_FILE.write_text(
        json.dumps({"completed_batches": sorted(completed)}), encoding="utf-8"
    )


def clear_progress() -> None:
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()



def load_sources() -> list[dict]:
    raw = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    configs = []
    seen: set[tuple] = set()

    for entry in raw:
        url: str = entry["url"].rstrip("/")
        parts = url.split("/")
        repo = f"{parts[-2]}/{parts[-1]}"
        branch = entry.get("branch", "main")

        for glob_path in entry.get("paths", [""]):
            base_path = glob_path.split("*")[0].rstrip("/")
            key = (repo, branch, base_path)
            if key in seen:
                continue
            seen.add(key)
            configs.append({"repo": repo, "path": base_path, "branch": branch})

    return configs

async def main():
    print("=" * 60)
    print("Conflux Expert - Content Ingestion Pipeline")
    print("=" * 60)

    print("\n[1/5] Initializing components...")
    github_pipeline = GitHubIngestionPipeline(settings.github_token)
    text_processor = TextProcessor(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    vector_store = VectorStore(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        embedding_model=settings.embedding_model,
        environment=settings.pinecone_environment,
    )

    print("\n[2/5] Loading content sources...")
    repo_configs = load_sources()
    print(f"Loaded {len(repo_configs)} sources from sources.json:")
    for cfg in repo_configs:
        print(f"  - {cfg['repo']} (branch: {cfg['branch']}, path: {cfg['path'] or '/'})")

    print("\n[3/5] Fetching documents from GitHub...")
    raw_documents = load_cache()
    if raw_documents is None:
        raw_documents = github_pipeline.fetch_multiple_repos(repo_configs)
        print(f"\nTotal documents fetched: {len(raw_documents)}")
        save_cache(raw_documents)
    else:
        print(f"Total documents (from cache): {len(raw_documents)}")

    print("\n[4/5] Processing and chunking documents...")
    all_chunks = []
    for doc in raw_documents:
        chunks = text_processor.process_document(
            content=doc["content"],
            source=doc["metadata"]["source"],
            title=doc["metadata"]["title"],
            url=doc["metadata"]["url"],
            doc_type="markdown",
            additional_metadata={
                "path": doc["metadata"]["path"],
                "branch": doc["metadata"]["branch"],
            },
        )
        all_chunks.extend(chunks)

    print(f"Total chunks created: {len(all_chunks)}")

    print("\n[5/5] Upserting to vector store...")
    progress = load_progress()
    try:
        stats = vector_store.upsert_documents(all_chunks, progress=progress)
    except Exception as e:
        save_progress(progress)  
        print(f"\nUpsert failed — progress saved to {PROGRESS_FILE.name}")
        print("Re-run the script to resume from where it left off.")
        raise

    clear_cache()
    clear_progress()

    print("\n" + "=" * 60)
    print("Ingestion Complete!")
    print("=" * 60)
    print(f"Documents fetched: {len(raw_documents)}")
    print(f"Chunks created:    {len(all_chunks)}")
    print(f"Vectors upserted:  {stats['total_upserted']}")
    print(f"Index:             {stats['index_name']}")

    index_stats = vector_store.get_stats()
    print(f"\nVector Store Stats:")
    print(f"  Total vectors: {index_stats.get('total_vector_count', 0)}")
    print("\nReady to serve queries!")


async def sync_all_sources() -> dict:
    github_pipeline = GitHubIngestionPipeline(settings.github_token)
    text_processor = TextProcessor(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    vector_store = VectorStore(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        embedding_model=settings.embedding_model,
        environment=settings.pinecone_environment,
    )

    repo_configs = load_sources()

    raw_documents = load_cache()
    if raw_documents is None:
        raw_documents = github_pipeline.fetch_multiple_repos(repo_configs)
        save_cache(raw_documents)

    all_chunks = []
    for doc in raw_documents:
        chunks = text_processor.process_document(
            content=doc["content"],
            source=doc["metadata"]["source"],
            title=doc["metadata"]["title"],
            url=doc["metadata"]["url"],
            doc_type="markdown",
            additional_metadata={
                "path": doc["metadata"]["path"],
                "branch": doc["metadata"]["branch"],
            },
        )
        all_chunks.extend(chunks)

    progress = load_progress()
    try:
        stats = vector_store.upsert_documents(all_chunks, progress=progress)
    except Exception:
        save_progress(progress)
        raise

    clear_cache()
    clear_progress()

    return {
        "synced_count": len(repo_configs),
        "documents_fetched": len(raw_documents),
        "chunks_created": len(all_chunks),
        "vectors_upserted": stats.get("total_upserted", 0),
    }


if __name__ == "__main__":
    asyncio.run(main())
