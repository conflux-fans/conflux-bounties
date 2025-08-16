import { config } from "dotenv";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import startServer from "./server.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updatePrivateKey } from "../core/config.js";
import * as services from "../core/services/index.js";
import { getSupportedNetworks, DEFAULT_NETWORK } from "../core/chains.js";
import { zodToJsonSchema } from "zod-to-json-schema";

// Environment variables - hardcoded values
// Use MCP_SERVER_PORT from env, default to 5004
const PORT = process.env.MCP_SERVER_PORT ? parseInt(process.env.MCP_SERVER_PORT, 10) : 5004;
const HOST = '0.0.0.0';

console.error(`Configured to listen on ${HOST}:${PORT}`);

// Setup Express
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Access-Control-Allow-Origin']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Keep track of active connections with session IDs
const connections = new Map<string, SSEServerTransport>();
// Map sessionId -> privateKey for per-session key isolation
const sessionKeys = new Map<string, string>();

let server: McpServer | null = null;
startServer().then(s => {
  server = s;
  console.error("MCP Server initialized successfully");

  // Register all routes here, now that server is ready!
  // @ts-ignore
  app.get("/sse", (req: Request, res: Response) => {
    console.error(`Received SSE connection request from ${req.ip}`);
    console.error(`Query parameters: ${JSON.stringify(req.query)}`);
    
    // Set CORS headers explicitly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Private-Key');
    
    if (!server) {
      console.error("Server not initialized yet, rejecting SSE connection");
      return res.status(503).send("Server not initialized");
    }
    
    // Allow client to specify session ID, or generate one
    const clientSessionId = req.query.sessionId?.toString();
    const sessionId = clientSessionId || generateSessionId();
    console.error(`Creating SSE session with ID: ${sessionId} (client provided: ${!!clientSessionId})`);
    
    // Optional: update private key from header if provided
    const headerKey = req.header('X-Private-Key');
    if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 0) {
      try { updatePrivateKey(headerKey.trim()); } catch {}
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    
    // Create transport - handle before writing to response
    try {
      console.error(`Creating SSE transport for session: ${sessionId}`);
      
      // Create and store the transport keyed by session ID
      const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
      connections.set(sessionId, transport);
      // Save per-session private key if provided
      if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 0) {
        sessionKeys.set(sessionId, headerKey.trim());
      }
      
      // Handle connection close
      req.on("close", () => {
        console.error(`SSE connection closed for session: ${sessionId}`);
        connections.delete(sessionId);
        sessionKeys.delete(sessionId);
      });
      
      // Connect transport to server - this must happen before sending any data
      server.connect(transport).then(() => {
        console.error(`SSE connection established for session: ${sessionId}`);
        
        // Send the session endpoint information to the client
        res.write(`event: endpoint\n`);
        res.write(`data: /messages?sessionId=${sessionId}\n\n`);
        
      }).catch((error: Error) => {
        console.error(`Error connecting transport to server: ${error}`);
        connections.delete(sessionId);
      });
    } catch (error) {
      console.error(`Error creating SSE transport: ${error}`);
      connections.delete(sessionId);
      res.status(500).send(`Internal server error: ${error}`);
    }
  });

  // @ts-ignore
  app.post("/messages", async (req: Request, res: Response) => {
    console.error(`Received MCP message request`);
    console.error(`Message body: ${JSON.stringify(req.body)}`);
    
    // Optional: update private key from header if provided
    const headerKey = req.header('X-Private-Key');
    if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 0) {
      try { updatePrivateKey(headerKey.trim()); } catch {}
    }

    // Check for session ID in query parameters
    const sessionId = req.query.sessionId?.toString();
    console.error(`Session ID from query: ${sessionId}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Private-Key');
    
    if (!server) {
      console.error("Server not initialized yet");
      return res.status(503).json({ error: "Server not initialized" });
    }

    try {
      const message = req.body;
      
      // For SSE sessions, process the message and let the server respond through SSE transport
      if (sessionId && connections.has(sessionId)) {
        console.error(`Processing message for SSE session ${sessionId}`);
        const transport = connections.get(sessionId);
        if (transport) {
          try {
            // Create a mock response handler that the SSE transport will handle
            const mockResponse = {
              json: (data: any) => {
                console.error(`Sending response through SSE transport for session ${sessionId}`);
                transport.send(data);
              },
              status: (code: number) => ({ end: () => {}, json: (data: any) => transport.send(data) })
            };
            
            // Process the message as if it's a direct HTTP request, but send response through SSE
            if (message.method === 'initialize') {
              const response = {
                jsonrpc: "2.0" as const,
                id: message.id,
                result: {
                  protocolVersion: message.params.protocolVersion,
                  capabilities: {
                    tools: { listChanged: true },
                    resources: { listChanged: true },
                    prompts: { listChanged: true }
                  },
                  serverInfo: {
                    name: "EVM-Server",
                    version: "1.0.0"
                  }
                }
              };
              transport.send(response);
              return res.status(200).end();
            }
            
                       if (message.method === 'tools/list') {
               // Guard: Ensure server and _registeredTools are initialized
               if (!server || !(server as any)._registeredTools) {
                 const errorResponse = {
                   jsonrpc: "2.0" as const,
                   id: message.id,
                   error: {
                     code: -32000,
                     message: "Server not initialized yet. Please try again in a moment."
                   }
                 };
                 transport.send(errorResponse);
                 return res.status(200).end();
               }
               // Dynamically get all registered tools from the MCP server, converting Zod schemas to JSON schema
               // @ts-ignore: Accessing private _registeredTools property for dynamic tool listing
               const tools = Object.entries((server as any)._registeredTools).map(([name, tool]) => ({
                 name,
                 description: (tool as any).description || "",
                 inputSchema: (tool as any).inputSchema
                   ? zodToJsonSchema((tool as any).inputSchema)
                   : { type: "object", properties: {}, required: [] }
               }));
               const response = {
                 jsonrpc: "2.0" as const,
                 id: message.id,
                 result: { tools }
               };
               console.error(`Sending tools/list response with ${tools.length} tools through SSE`);
               transport.send(response);
               return res.status(200).end();
             }
             
              if (message.method === 'tools/call') {
               console.error(`🔧 Handling tools/call for tool: ${message.params?.name}`);
               console.error(`   Arguments: ${JSON.stringify(message.params?.arguments, null, 2)}`);
               try {
                 const toolName = message.params.name;
                  const toolArgs = message.params.arguments || {};
                  // Inject per-session private key if available
                  const sessionKey = sessionId ? sessionKeys.get(sessionId) : undefined;
                  if (sessionKey && typeof toolArgs === 'object' && toolArgs !== null) {
                    (toolArgs as any).__privateKey = sessionKey;
                  }
                 const toolHandler = getToolHandler(server, toolName);
                 if (!toolHandler || typeof toolHandler.callback !== 'function') {
                   const errorResponse = {
                     jsonrpc: "2.0" as const,
                     id: message.id,
                     error: {
                       code: -32601,
                       message: `Tool not found or invalid handler: ${toolName}`
                     }
                   };
                   transport.send(errorResponse);
                   return res.status(200).end();
                 }
                 // Call the tool handler's callback (it may be async)
                 const result = await toolHandler.callback(toolArgs);
                 const response = {
                   jsonrpc: "2.0" as const,
                   id: message.id,
                   result: result
                 };
                 transport.send(response);
                 return res.status(200).end();
               } catch (error) {
                 console.error(`❌ Error calling real blockchain tool ${message.params.name}: ${error}`);
                 const errorResponse = {
                   jsonrpc: "2.0" as const,
                   id: message.id,
                   error: {
                     code: -32603,
                     message: `Error calling tool: ${error}`
                   }
                 };
                 transport.send(errorResponse);
                 return res.status(200).end();
               }
             }

              // prompts/list for SSE sessions
              if (message.method === 'prompts/list') {
                if (!server || !(server as any)._registeredPrompts) {
                  const errorResponse = {
                    jsonrpc: "2.0" as const,
                    id: message.id,
                    error: { code: -32000, message: "Server not initialized yet. Please try again in a moment." }
                  };
                  transport.send(errorResponse);
                  return res.status(200).end();
                }
                // @ts-ignore access private property
                const prompts = Object.entries((server as any)._registeredPrompts).map(([name, prompt]) => ({
                  name,
                  description: (prompt as any).description || "",
                  inputSchema: (prompt as any).inputSchema
                    ? zodToJsonSchema((prompt as any).inputSchema)
                    : { type: "object", properties: {}, required: [] }
                }));
                const response = { jsonrpc: "2.0" as const, id: message.id, result: { prompts } };
                transport.send(response);
                return res.status(200).end();
              }

              // prompts/execute for SSE sessions
              if (message.method === 'prompts/execute') {
                try {
                  const promptName = message.params.name;
                  const promptArgs = message.params.arguments || {};
                  const promptHandler = getPromptHandler(server, promptName);
                  if (!promptHandler || typeof promptHandler.callback !== 'function') {
                    const errorResponse = {
                      jsonrpc: "2.0" as const,
                      id: message.id,
                      error: { code: -32601, message: `Prompt not found or invalid handler: ${promptName}` }
                    };
                    transport.send(errorResponse);
                    return res.status(200).end();
                  }
                  const result = await promptHandler.callback(promptArgs);
                  const response = { jsonrpc: "2.0" as const, id: message.id, result };
                  transport.send(response);
                  return res.status(200).end();
                } catch (error) {
                  const errorResponse = {
                    jsonrpc: "2.0" as const,
                    id: message.id,
                    error: { code: -32603, message: `Error executing prompt: ${error}` }
                  };
                  transport.send(errorResponse);
                  return res.status(200).end();
                }
              }
            
                       // Handle notifications/initialized (no response needed)
             if (message.method === 'notifications/initialized') {
               console.error('Handling notifications/initialized (no response needed)');
               return res.status(200).end();
             }
             
             // For other methods, return not implemented
             const errorResponse = {
               jsonrpc: "2.0" as const,
               id: message.id,
               error: {
                 code: -32601,
                 message: `Method not found: ${message.method}`
               }
             };
             transport.send(errorResponse);
             return res.status(200).end();
            
          } catch (error) {
            console.error(`Error processing message for SSE session: ${error}`);
            return res.status(500).json({ error: "Internal server error" });
          }
        } else {
          console.error(`SSE transport not found for session ${sessionId}`);
          return res.status(404).json({ error: "Session not found" });
        }
      }
      
      // Handle initialize method (for direct HTTP requests only)
      if (message.method === 'initialize') {
        console.error('Handling initialize request for direct HTTP');
        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: message.params.protocolVersion,
            capabilities: {
              tools: { listChanged: true },
              resources: { listChanged: true },
              prompts: { listChanged: true }
            },
            serverInfo: {
              name: "EVM-Server",
              version: "1.0.0"
            }
          }
        };
        console.error('Sending initialize response for direct HTTP');
        return res.json(response);
      }
      
      // Handle tools/list method (for direct HTTP requests only)
      if (message.method === 'tools/list') {
        console.error('Handling tools/list request for direct HTTP');
        // Guard: Ensure server and _registeredTools are initialized
        if (!server || !(server as any)._registeredTools) {
          const errorResponse = {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32000,
              message: "Server not initialized yet. Please try again in a moment."
            }
          };
          return res.json(errorResponse);
        }
        // Dynamically get all registered tools from the MCP server, converting Zod schemas to JSON schema
        // @ts-ignore: Accessing private _registeredTools property for dynamic tool listing
        const tools = Object.entries((server as any)._registeredTools).map(([name, tool]) => ({
          name,
          description: (tool as any).description || "",
          inputSchema: (tool as any).inputSchema
            ? zodToJsonSchema((tool as any).inputSchema)
            : { type: "object", properties: {}, required: [] }
        }));
        const response = {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools
          }
        };
        console.error(`Sending tools/list response with ${tools.length} tools for direct HTTP`);
        return res.json(response);
      }
      
      // Handle prompts/list method (for direct HTTP requests only)
      if (message.method === 'prompts/list') {
        console.error('Handling prompts/list request for direct HTTP');
        if (!server || !(server as any)._registeredPrompts) {
          const errorResponse = {
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32000, message: "Server not initialized yet. Please try again in a moment." }
          };
          return res.json(errorResponse);
        }
        // @ts-ignore: Access private registry
        const prompts = Object.entries((server as any)._registeredPrompts).map(([name, prompt]) => ({
          name,
          description: (prompt as any).description || "",
          inputSchema: (prompt as any).inputSchema
            ? zodToJsonSchema((prompt as any).inputSchema)
            : { type: "object", properties: {}, required: [] }
        }));
        const response = { jsonrpc: "2.0", id: message.id, result: { prompts } };
        return res.json(response);
      }

      // Handle prompts/execute method (for direct HTTP requests only)
      if (message.method === 'prompts/execute') {
        console.error(`Handling prompts/execute for prompt: ${message.params?.name}`);
        try {
          const promptName = message.params.name;
          const promptArgs = message.params.arguments || {};
          const promptHandler = getPromptHandler(server, promptName);
          if (!promptHandler || typeof promptHandler.callback !== 'function') {
            const errorResponse = {
              jsonrpc: "2.0" as const,
              id: message.id,
              error: { code: -32601, message: `Prompt not found or invalid handler: ${promptName}` }
            };
            return res.json(errorResponse);
          }
          const result = await promptHandler.callback(promptArgs);
          const response = { jsonrpc: "2.0" as const, id: message.id, result };
          return res.json(response);
        } catch (error) {
          const errorResponse = {
            jsonrpc: "2.0" as const,
            id: message.id,
            error: { code: -32603, message: `Error executing prompt: ${error}` }
          };
          return res.json(errorResponse);
        }
      }

      // Handle tools/call method (for direct HTTP requests only)
      if (message.method === 'tools/call') {
        console.error(`Handling tools/call request for tool: ${message.params.name}`);
        const toolName = message.params.name;
        const toolArgs = message.params.arguments || {};
        // Inject per-session private key if available via query or header
        const sessionKey = (req.query.sessionId && sessionKeys.get(String(req.query.sessionId))) || req.header('X-Private-Key');
        if (sessionKey && typeof toolArgs === 'object' && toolArgs !== null) {
          (toolArgs as any).__privateKey = String(sessionKey);
        }
        try {
          const toolHandler = getToolHandler(server, toolName);
          if (!toolHandler || typeof toolHandler.callback !== 'function') {
            const errorResponse = {
              jsonrpc: "2.0" as const,
              id: message.id,
              error: {
                code: -32601,
                message: `Tool not found or invalid handler: ${toolName}`
              }
            };
            return res.json(errorResponse);
          }
          // Call the tool handler's callback (it may be async)
          const result = await toolHandler.callback(toolArgs);
          const response = {
            jsonrpc: "2.0" as const,
            id: message.id,
            result: result
          };
          return res.json(response);
        } catch (error) {
          console.error(`Error calling tool ${toolName}:`, error);
          const errorResponse = {
            jsonrpc: "2.0" as const,
            id: message.id,
            error: {
              code: -32603,
              message: `Error calling tool ${toolName}: ${error}`
            }
          };
          return res.json(errorResponse);
        }
      }
      
      // Handle unknown methods
      console.error(`Unknown method: ${message.method}`);
      const errorResponse = {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      };
      return res.json(errorResponse);
      
    } catch (error) {
      console.error(`Exception handling MCP request: ${error}`);
      const errorResponse = {
        jsonrpc: "2.0",
        id: req.body.id || null,
        error: {
          code: -32603,
          message: `Internal server error: ${error}`
        }
      };
      return res.json(errorResponse);
    }
  });

  // Add a simple health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ 
      status: "ok",
      server: server ? "initialized" : "initializing",
      // connections is now in this scope
      activeConnections: connections.size,
      connectedSessionIds: Array.from(connections.keys())
    });
  });

  // Add endpoint to set private key
  // @ts-ignore
  app.post("/config", (req: Request, res: Response) => {
    const { privateKey } = req.body;
    if (!privateKey) {
      return res.status(400).json({ error: "Private key is required" });
    }
    try {
      updatePrivateKey(privateKey);
      return res.status(200).json({ success: true, message: "Private key updated successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to update private key" });
    }
  });

      // Handle MCP protocol at root endpoint (for StreamableHTTPClientTransport)
  // @ts-ignore  
  app.post("/", async (req: Request, res: Response) => {
    // Delegate to the messages endpoint
    req.url = '/messages';
    return app._router.handle(req, res, () => {});
  });

  // @ts-ignore
  app.get("/", (req: Request, res: Response) => {
    // Check if this is an SSE request
    const acceptHeader = req.headers.accept;
    if (acceptHeader && acceptHeader.includes('text/event-stream')) {
      // Handle as SSE request at root
      return res.redirect('/sse');
    }
    // Return server info for regular requests
    res.status(200).json({
      name: "MCP Server",
      version: "1.0.0",
      endpoints: {
        sse: "/sse",
        messages: "/messages", 
        health: "/health",
        config: "/config"
      },
      status: server ? "ready" : "initializing",
      activeConnections: connections.size
    });
  });

  // Start the HTTP server ONLY after server is ready
  const httpServer = app.listen(PORT, HOST, () => {
    console.error(`Template MCP Server running at http://${HOST}:${PORT}`);
    console.error(`SSE endpoint: http://${HOST}:${PORT}/sse`);
    console.error(`Messages endpoint: http://${HOST}:${PORT}/messages (sessionId optional if only one connection)`);
    console.error(`Health check: http://${HOST}:${PORT}/health`);
  }).on('error', (err: Error) => {
    console.error(`Server error: ${err}`);
  });

  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.error('Shutting down server...');
    connections.forEach((transport, sessionId) => {
      console.error(`Closing connection for session: ${sessionId}`);
    });
    process.exit(0);
  });

}).catch(error => {
  console.error("Failed to initialize server:", error);
  process.exit(1);
});

// Add this utility function near the top (after server is initialized):
function getToolHandler(server: any, toolName: string) {
  // Try to access the private _registeredTools registry
  if (server && typeof server === 'object' && typeof toolName === 'string') {
    if (server._registeredTools && typeof server._registeredTools === 'object') {
      return server._registeredTools[toolName];
    }
  }
  return undefined;
}

// Utility to access registered prompts from MCP server
function getPromptHandler(server: any, promptName: string) {
  if (server && typeof server === 'object' && typeof promptName === 'string') {
    if ((server as any)._registeredPrompts && typeof (server as any)._registeredPrompts === 'object') {
      return (server as any)._registeredPrompts[promptName];
    }
  }
  return undefined;
}

// Helper function to generate a UUID-like session ID
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 