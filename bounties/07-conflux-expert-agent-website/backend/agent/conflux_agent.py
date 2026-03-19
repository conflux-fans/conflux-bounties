import json
import logging
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from google import genai
from google.genai import types as genai_types

from config import settings
from rag.vector_store import VectorStore
from tools.confluxscan_client import CONFLUXSCAN_TOOLS, ConfluxScanClient, NetworkType
from tools.mcp_client import MCPClient

logger = logging.getLogger(__name__)


class ConfluxExpertAgent:
    def __init__(
        self,
        vector_store: VectorStore,
        confluxscan_client: ConfluxScanClient,
        mcp_client: Optional[MCPClient] = None,
        model: str = "gemini-3-flash-preview",
        temperature: float = 0.7,
    ):
        self.vector_store = vector_store
        self.confluxscan = confluxscan_client
        self.mcp_client = mcp_client

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_name = model
        self.generation_config = genai_types.GenerateContentConfig(
            temperature=temperature,
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
        )
        self.temperature = temperature

        self.conversation_history: List[Dict[str, str]] = []

    def _format_context(
        self, search_results: List[Dict[str, Any]]
    ) -> tuple[str, List[Dict[str, Any]]]:
        context_parts: List[str] = []
        citations: List[Dict[str, Any]] = []

        canonical_by_url: Dict[str, int] = {}

        for i, result in enumerate(search_results, 1):
            metadata = result.get("metadata", {}) or {}
            text = result.get("text", "") or ""

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

    def _build_system_prompt(
        self, context: str, citations: List[Dict[str, str]]
    ) -> str:
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
        stream: bool = True,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        logger.info(f"Chat: query='{user_message[:80]}...', stream={stream}")

        yield {"type": "status", "message": "Searching documentation..."}
        search_results = self.vector_store.search(
            query=user_message, top_k=settings.top_k_results
        )
        logger.info(f"RAG returned {len(search_results)} results")
        context, citations = self._format_context(search_results)
        yield {
            "type": "context",
            "results": len(search_results),
            "citations": citations,
        }

        declarations: List[genai_types.FunctionDeclaration] = []
        if self.mcp_client:
            try:
                declarations = await self.mcp_client.ensure_tools_loaded()
            except Exception as e:
                logger.warning(f"MCP tools unavailable, running RAG-only: {e}")

        _SYSTEM = (
            "You are the Conflux Expert, an AI assistant specialized in Conflux blockchain technology.\n"
            "When the user asks for live blockchain data (balances, transactions, block info, gas prices, etc.),\n"
            "use the available tools to fetch it.\n"
            "Always cite documentation sources with [1], [2], etc. inline."
        )

        user_content = (
            f"CONTEXT FROM DOCUMENTATION:\n{context}\n\n"
            f"CONVERSATION HISTORY:\n{self._format_history()}\n\n"
            f"USER QUESTION: {user_message}\n\n"
            "Cite sources with [1][2] etc. Use available tools for any live blockchain data needed."
        )

        contents: List[genai_types.Content] = [
            genai_types.Content(
                role="user", parts=[genai_types.Part(text=user_content)]
            )
        ]

        if declarations:
            yield {"type": "status", "message": "Thinking..."}

            tool_config = genai_types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                temperature=self.temperature,
                top_p=0.95,
                top_k=40,
                max_output_tokens=8192,
                tools=[genai_types.Tool(function_declarations=declarations)],
            )

            for _round in range(5):  # safety cap: max 5 tool rounds per message
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=tool_config,
                )
                model_content = response.candidates[0].content
                function_calls = [
                    p.function_call for p in model_content.parts if p.function_call
                ]

                if not function_calls:
                    break

                contents.append(model_content)

                response_parts: List[genai_types.Part] = []
                for fc in function_calls:
                    yield {
                        "type": "status",
                        "message": f"Fetching live data ({fc.name})...",
                    }
                    try:
                        result = await self.mcp_client.call_tool(fc.name, dict(fc.args))
                        logger.info(f"MCP '{fc.name}': {result}")
                        yield {"type": "tool_result", "tool": fc.name, "result": result}
                    except Exception as e:
                        logger.error(f"MCP '{fc.name}' failed: {e}")
                        result = {"error": str(e)}

                    response_parts.append(
                        genai_types.Part(
                            function_response=genai_types.FunctionResponse(
                                name=fc.name,
                                response={"result": result},
                            )
                        )
                    )

                contents.append(genai_types.Content(role="user", parts=response_parts))

        yield {"type": "status", "message": "Generating response..."}

        final_config = genai_types.GenerateContentConfig(
            system_instruction=_SYSTEM,
            temperature=self.temperature,
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
        )

        try:
            full_content = ""
            for chunk in self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=final_config,
            ):
                if getattr(chunk, "text", None):
                    full_content += chunk.text
                    yield {"type": "content", "delta": chunk.text}

            self.conversation_history.append({"role": "user", "content": user_message})
            self.conversation_history.append(
                {"role": "assistant", "content": full_content}
            )

            yield {"type": "citations", "citations": citations}
            yield {
                "type": "done",
                "message": full_content,
                "citations": citations,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            yield {"type": "error", "message": f"Failed to generate response: {str(e)}"}

    def _format_history(self) -> str:
        """Format conversation history for prompt."""
        if not self.conversation_history:
            return "No previous conversation."

        history_text = []
        for msg in self.conversation_history[-settings.max_conversation_memory :]:
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
