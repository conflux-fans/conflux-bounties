import pino from "pino";

// When running as an MCP server, stdout belongs to the JSON-RPC transport.
// All application logs must go to stderr to avoid corrupting the protocol.
const isMcp = process.argv[1]?.includes("mcp-server");

export const logger = isMcp
  ? pino({ level: process.env.LOG_LEVEL || "info" }, pino.destination(2))
  : pino({
      level: process.env.LOG_LEVEL || "info",
      transport: { target: "pino-pretty", options: { colorize: true } },
    });
