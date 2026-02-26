"""Vector store operations using Pinecone."""
import time
from typing import List, Dict, Any, Optional
from pinecone import Pinecone, ServerlessSpec
from pinecone.exceptions import PineconeApiException
import tiktoken


class VectorStore:
    NAMESPACE = "__default__"
    DIMENSION = 1024  

    def __init__(
        self,
        api_key: str,
        index_name: str = "conflux-expert",
        embedding_model: str = "llama-text-embed-v2",
        environment: str = "us-east-1",
    ):
        self.pc = Pinecone(api_key=api_key)
        self.index_name = index_name
        self.embedding_model = embedding_model
        self.environment = environment
        self.encoding = tiktoken.get_encoding("cl100k_base")
        self._initialize_index()

    def _initialize_index(self):
        existing = {idx.name for idx in self.pc.list_indexes()}

        if self.index_name not in existing:
            print(f"Creating index: {self.index_name}")
            self.pc.create_index(
                name=self.index_name,
                dimension=self.DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=self.environment),
            )
            print(f"Index '{self.index_name}' created.")
        else:
            print(f"Connected to existing index: {self.index_name}")

        self.index = self.pc.Index(self.index_name)


    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def _embed(self, texts: list[str], input_type: str, retries: int = 6) -> list[list[float]]:
        delay = 10  # seconds – start conservative
        for attempt in range(1, retries + 1):
            try:
                response = self.pc.inference.embed(
                    model=self.embedding_model,
                    inputs=texts,
                    parameters={"input_type": input_type, "truncate": "END"},
                )
                return [item["values"] for item in response]
            except PineconeApiException as e:
                if e.status == 429 and attempt < retries:
                    wait = delay * (2 ** (attempt - 1))  # 10, 20, 40, 80, 160 s
                    print(f"  Rate limited (429). Waiting {wait}s before retry {attempt}/{retries - 1}...")
                    time.sleep(wait)
                else:
                    raise

    def upsert_documents(
        self,
        documents: List[Dict[str, Any]],
        batch_size: int = 96,
        batch_delay: float = 15.0,  # free tier
        progress: set | None = None,
    ) -> Dict[str, Any]:
        total = len(documents)
        num_batches = (total + batch_size - 1) // batch_size
        # Use the caller's set in-place so progress is visible even on exception
        completed: set[int] = progress if progress is not None else set()
        skipped = len(completed)
        if skipped:
            print(f"Resuming upsert — skipping {skipped} already-completed batches.")
        print(f"Upserting {total} documents in {num_batches} batches...")

        for batch_num, start in enumerate(range(0, total, batch_size), 1):
            if batch_num in completed:
                print(f"  Batch {batch_num}/{num_batches} already done — skipping")
                continue

            batch = documents[start : start + batch_size]
            texts = [doc["text"] for doc in batch]

            embeddings = self._embed(texts, input_type="passage")

            vectors = [
                {
                    "id": doc["id"],
                    "values": emb,
                    "metadata": {**doc.get("metadata", {}), "text": doc["text"]},
                }
                for doc, emb in zip(batch, embeddings)
            ]

            self.index.upsert(vectors=vectors, namespace=self.NAMESPACE)
            completed.add(batch_num)
            print(f"  Batch {batch_num}/{num_batches} done ({len(batch)} records)")

            # Respect free-tier rate limit between batches (not after the last one)
            if batch_num < num_batches and batch_delay > 0:
                time.sleep(batch_delay)

        return {
            "total_upserted": total,
            "index_name": self.index_name,
            "namespace": self.NAMESPACE,
            "completed_batches": completed,
        }

    def delete_by_filter(self, filter_dict: Dict[str, Any]):
        self.index.delete(filter=filter_dict, namespace=self.NAMESPACE)
        print(f"Deleted vectors matching: {filter_dict}")

    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None,
        include_metadata: bool = True,
    ) -> List[Dict[str, Any]]:
        query_vector = self._embed([query], input_type="query")[0]

        try:
            response = self.index.query(
                vector=query_vector,
                top_k=top_k,
                filter=filter_dict,
                include_metadata=include_metadata,
                namespace=self.NAMESPACE,
            )
        except Exception as e:
            print(f"Search error: {e}")
            raise

        results = []
        for match in response.get("matches", []):
            meta = match.get("metadata", {})
            results.append({
                "id": match["id"],
                "score": match["score"],
                "text": meta.pop("text", ""),
                "metadata": meta,
            })

        return results

    def get_stats(self) -> Dict[str, Any]:
        raw = self.index.describe_index_stats()

        def _sanitize(value: Any) -> Any:
            # primitives
            if value is None or isinstance(value, (str, int, float, bool)):
                return value

            if isinstance(value, dict):
                return {k: _sanitize(v) for k, v in value.items()}
            if isinstance(value, list):
                return [_sanitize(v) for v in value]
            if isinstance(value, tuple):
                return tuple(_sanitize(v) for v in value)
            if isinstance(value, set):
                return [_sanitize(v) for v in value]

            if hasattr(value, "to_dict") and callable(getattr(value, "to_dict")):
                try:
                    return _sanitize(value.to_dict())
                except Exception:
                    pass
            if hasattr(value, "dict") and callable(getattr(value, "dict")):
                try:
                    return _sanitize(value.dict())
                except Exception:
                    pass

            # objects with __dict__ (fallback)
            if hasattr(value, "__dict__"):
                try:
                    return _sanitize(vars(value))
                except Exception:
                    pass

            # final fallback — stringify safely
            try:
                return str(value)
            except Exception:
                return repr(value)

        return _sanitize(raw)
