"""Conflux Expert Agent - RAG + Tool orchestration."""
from typing import List, Dict, Any, Optional, AsyncGenerator
from google import genai
from google.genai import types as genai_types
import json
import logging
from datetime import datetime

from config import settings
from rag.vector_store import VectorStore
from tools.confluxscan_client import ConfluxScanClient, NetworkType, CONFLUXSCAN_TOOLS


logger = logging.getLogger(__name__)


class ConfluxExpertAgent:
    def __init__(
        self,
        vector_store: VectorStore,
        confluxscan_client: ConfluxScanClient,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.7
    ):
        """Initialize the agent.
        
        Args:
            vector_store: VectorStore instance for RAG
            confluxscan_client: ConfluxScan API client
            model: Gemini model name
            temperature: Sampling temperature
        """
        self.vector_store = vector_store
        self.confluxscan = confluxscan_client
        
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_name = model
        self.generation_config = genai_types.GenerateContentConfig(
            temperature=temperature,
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
        )
        self.temperature = temperature
        
        # Conversation memory
        self.conversation_history: List[Dict[str, str]] = []
        
    def _format_context(self, search_results: List[Dict[str, Any]]) -> tuple[str, List[Dict[str, Any]]]:
        """Format search results into context string and return normalized citations.

        This performs non-destructive normalization so:
        - every citation always includes `id` and `index` (both set to the original result index)
        - duplicates (same URL) are annotated with `duplicate_of` pointing to the canonical index
        - context string keeps original `[n]` markers so prompts remain consistent

        The change is backward-compatible: callers still receive one citation per
        search result index, but duplicate entries are flagged for client-side
        deduping if desired.
        """
        context_parts: List[str] = []
        citations: List[Dict[str, Any]] = []

        # Map URLs (or title-based keys when URL missing) -> canonical index
        canonical_by_url: Dict[str, int] = {}

        for i, result in enumerate(search_results, 1):
            metadata = result.get("metadata", {}) or {}
            text = result.get("text", "") or ""

            # Add to context with citation marker (leave indices unchanged)
            context_parts.append(f"[{i}] {text}")

            url = (metadata.get("url") or "").strip()
            title = metadata.get("title", "Unknown")
            source = metadata.get("source", "")
            score = result.get("score")

            key = url if url else f"no-url:{title}"

            if key in canonical_by_url:
                duplicate_of = canonical_by_url[key]
            else:
                canonical_by_url[key] = i
                duplicate_of = None

            citation: Dict[str, Any] = {
                "index": i,
                "id": i,
                "title": title,
                "url": url,
                "source": source,
                "score": score,
            }

            if duplicate_of is not None and duplicate_of != i:
                citation["duplicate_of"] = duplicate_of

            citations.append(citation)

        context_string = "\n\n".join(context_parts)
        return context_string, citations
    
    def _build_system_prompt(self, context: str, citations: List[Dict[str, str]]) -> str:
        return f"""You are the Conflux Expert, an AI assistant specialized in the Conflux blockchain ecosystem.

Your role is to provide accurate, helpful answers about Conflux technology, development, and ecosystem.

CONTEXT FROM DOCUMENTATION:
{context}

AVAILABLE CITATIONS:
{json.dumps(citations, indent=2)}

INSTRUCTIONS:
1. Answer the user's question based on the provided context
2. ALWAYS cite your sources using [1], [2], etc. format when referencing information
3. If the context doesn't contain enough information, say so clearly
4. Be concise but thorough
5. Use technical terminology when appropriate but explain complex concepts
6. If you use information from the context, you MUST cite it
7. Provide code examples when relevant
8. If live blockchain data would be helpful, you can use the available tools

CITATION FORMAT:
- When referencing information, add [1] or [2] etc. inline
- Example: "Conflux uses a Tree-Graph consensus algorithm [1]."
- Multiple sources: "The eSpace bridge connects Core and eSpace [1][2]."

Remember: Every factual claim should have at least one citation."""
    
    async def chat(
        self,
        user_message: str,
        stream: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a chat message with RAG and tool calling.
        
        Args:
            user_message: User's question
            stream: Whether to stream the response
            
        Yields:
            Response chunks with type: 'context', 'tool', 'content', 'citations', 'done'
        """
        logger.info(f"Chat started: query='{user_message[:100]}...', stream={stream}")
        
        # Step 1: Retrieve relevant context
        yield {
            "type": "status",
            "message": "Searching documentation..."
        }
        
        search_results = self.vector_store.search(
            query=user_message,
            top_k=settings.top_k_results
        )
        logger.info(f"RAG search returned {len(search_results)} results")
        
        context, citations = self._format_context(search_results)
        
        yield {
            "type": "context",
            "results": len(search_results),
            "citations": citations
        }
        
        # Step 2: Build prompt with context

        prompt = f"""You are the Conflux Expert, an AI assistant specialized in Conflux blockchain technology.

CONTEXT FROM DOCUMENTATION:
{context}

IMPORTANT INSTRUCTIONS:
- Answer based on the provided context
- ALWAYS cite sources using [1], [2], etc. format referring to the context above
- If asked about live blockchain data (balances, transactions, gas prices), mention you can check ConfluxScan
- Be accurate and technical when needed
- Keep responses concise but complete

CONVERSATION HISTORY:
{self._format_history()}

USER QUESTION: {user_message}

ANSWER (remember to cite sources with [1][2] etc):"""
        
        # Step 3: Call Gemini
        yield {
            "type": "status",
            "message": "Generating response..."
        }
        
        try:
            if stream:
                response = self.client.models.generate_content_stream(
                    model=self.model_name,
                    contents=prompt,
                    config=self.generation_config,
                )
            else:
                response = [self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=self.generation_config,
                )]

            if stream:
                full_content = ""
                for chunk in response:
                    if getattr(chunk, "text", None):
                        full_content += chunk.text
                        yield {
                            "type": "content",
                            "delta": chunk.text
                        }
                        
                # Update conversation history
                self.conversation_history.append({"role": "user", "content": user_message})
                self.conversation_history.append({"role": "assistant", "content": full_content})

                # Send final citations
                yield {
                    "type": "citations",
                    "citations": citations
                }

                yield {
                    "type": "done",
                    "message": full_content,
                    "citations": citations,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            print(f"Error generating response: {e}")
            yield {
                "type": "error",
                "message": f"Failed to generate response: {str(e)}"
            }
    
    def _format_history(self) -> str:
        """Format conversation history for prompt."""
        if not self.conversation_history:
            return "No previous conversation."
        
        history_text = []
        for msg in self.conversation_history[-settings.max_conversation_memory:]:
            role = msg["role"].upper()
            content = msg["content"]
            history_text.append(f"{role}: {content}")
        
        return "\n".join(history_text)
    
    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []
    
    def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history."""
        return self.conversation_history.copy()
