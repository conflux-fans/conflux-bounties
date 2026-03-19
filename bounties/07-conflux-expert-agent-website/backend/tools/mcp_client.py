import json
import logging
from typing import Any, Dict, List, Optional

import httpx
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

_TYPE_MAP: Dict[str, str] = {
    "string": "STRING",
    "number": "NUMBER",
    "integer": "INTEGER",
    "boolean": "BOOLEAN",
    "object": "OBJECT",
    "array": "ARRAY",
}


class MCPClient:
    def __init__(self, server_url: str = "http://localhost:5004"):
        self.server_url = server_url.rstrip("/")
        self.timeout = 30.0
        self._cached_declarations: Optional[List[genai_types.FunctionDeclaration]] = (
            None
        )

    async def _sse_call(
        self,
        method: str,
        params: Dict[str, Any],
        extra_headers: Optional[Dict[str, str]] = None,
        request_id: str = "1",
    ) -> Dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }
        sse_headers = {"Accept": "text/event-stream", **(extra_headers or {})}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "GET", f"{self.server_url}/sse", headers=sse_headers
            ) as sse:
                current_event: Optional[str] = None

                async for raw_line in sse.aiter_lines():
                    if raw_line.startswith("event:"):
                        current_event = raw_line[6:].strip()

                    elif raw_line.startswith("data:"):
                        data = raw_line[5:].strip()

                        if current_event == "endpoint":
                            session_url = (
                                f"{self.server_url}{data}"
                                if data.startswith("/")
                                else data
                            )
                            logger.debug(f"MCP session URL: {session_url}")
                            post_headers = {
                                "Content-Type": "application/json",
                                **(extra_headers or {}),
                            }
                            resp = await client.post(
                                session_url, json=payload, headers=post_headers
                            )
                            if resp.status_code not in (200, 202):
                                raise ValueError(
                                    f"MCP POST failed: {resp.status_code} {resp.text}"
                                )

                        elif current_event == "message":
                            msg = json.loads(data)
                            if str(msg.get("id")) == request_id:
                                if "error" in msg:
                                    raise ValueError(
                                        f"MCP error: {msg['error'].get('message', msg['error'])}"
                                    )
                                return msg.get("result", {})

        raise ValueError("No result received from MCP server before stream closed")

    async def list_tools(self) -> List[Dict[str, Any]]:
        result = await self._sse_call("tools/list", {})
        return result.get("tools", [])

    async def call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        private_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        extra: Dict[str, str] = {}
        if private_key:
            extra["X-Private-Key"] = private_key

        result = await self._sse_call(
            "tools/call",
            {"name": tool_name, "arguments": arguments},
            extra_headers=extra or None,
        )

        content = result.get("content", [])
        if content and content[0].get("type") == "text":
            try:
                return json.loads(content[0]["text"])
            except json.JSONDecodeError:
                return {"raw": content[0]["text"]}
        return result

    async def ensure_tools_loaded(self) -> List[genai_types.FunctionDeclaration]:
        if self._cached_declarations is not None:
            return self._cached_declarations

        tools = await self.list_tools()
        self._cached_declarations = [self._to_declaration(t) for t in tools]
        logger.info(
            f"Loaded {len(self._cached_declarations)} MCP tools as Gemini declarations"
        )
        return self._cached_declarations

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.server_url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    def _to_declaration(
        self, mcp_tool: Dict[str, Any]
    ) -> genai_types.FunctionDeclaration:
        return genai_types.FunctionDeclaration(
            name=mcp_tool["name"],
            description=mcp_tool.get("description", ""),
            parameters=self._convert_schema(mcp_tool.get("inputSchema", {})),
        )

    def _convert_schema(self, schema: Dict[str, Any]) -> genai_types.Schema:
        json_type = schema.get("type", "object")
        kwargs: Dict[str, Any] = {"type": _TYPE_MAP.get(json_type, "STRING")}

        if "description" in schema:
            kwargs["description"] = schema["description"]
        if "enum" in schema:
            kwargs["enum"] = schema["enum"]
        if json_type == "object" and "properties" in schema:
            kwargs["properties"] = {
                k: self._convert_schema(v) for k, v in schema["properties"].items()
            }
            if "required" in schema:
                kwargs["required"] = schema["required"]
        if json_type == "array":
            kwargs["items"] = (
                self._convert_schema(schema["items"])
                if "items" in schema
                else genai_types.Schema(type="OBJECT")
            )

        return genai_types.Schema(**kwargs)
