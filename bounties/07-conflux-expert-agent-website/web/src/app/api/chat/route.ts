/**
 * Chat API Route - Streaming RAG responses with Tool Integration
 * 
 * POST /api/chat
 * Body: { message: string, history?: Array<{role, content}> }
 * Returns: Server-Sent Events stream
 */

import { NextRequest } from 'next/server';
import { getQueryEmbedding, generateRAGResponse, formatContext } from '@/lib/gemini';
import { searchDocuments } from '@/lib/supabase';
import { executeTool, getCFXPrice } from '@/lib/confluxscan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Patterns that suggest tool usage is needed
const TOOL_PATTERNS = {
    balance: /balance\s*(of|for)?\s*(0x[a-fA-F0-9]{40})/i,
    price: /\b(cfx|conflux)\s*(price|worth|value|cost)\b/i,
    transactions: /transactions?\s*(of|for|from)?\s*(0x[a-fA-F0-9]{40})/i,
    contract: /contract\s*(info|details|about)?\s*(0x[a-fA-F0-9]{40})/i,
};

/**
 * Detect if the message needs tool execution
 */
function detectToolNeed(message: string): { tool: string; params: Record<string, string> } | null {
    // Check for balance query
    const balanceMatch = message.match(TOOL_PATTERNS.balance);
    if (balanceMatch) {
        return { tool: 'get_account_balance', params: { address: balanceMatch[2] } };
    }

    // Check for price query
    if (TOOL_PATTERNS.price.test(message)) {
        return { tool: 'get_cfx_price', params: {} };
    }

    // Check for transaction query
    const txMatch = message.match(TOOL_PATTERNS.transactions);
    if (txMatch) {
        return { tool: 'get_recent_transactions', params: { address: txMatch[2] } };
    }

    // Check for contract query
    const contractMatch = message.match(TOOL_PATTERNS.contract);
    if (contractMatch) {
        return { tool: 'get_contract_info', params: { address: contractMatch[2] } };
    }

    return null;
}

export async function POST(request: NextRequest) {
    try {
        const { message, history = [] } = await request.json();

        if (!message || typeof message !== 'string') {
            return new Response(
                JSON.stringify({ error: 'Message is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Step 1: Check if tool execution is needed
        const toolNeed = detectToolNeed(message);
        let toolResult: string | null = null;

        if (toolNeed) {
            try {
                toolResult = await executeTool(toolNeed.tool, toolNeed.params);
            } catch (error) {
                console.error('Tool execution error:', error);
                toolResult = 'Unable to fetch live data at this time.';
            }
        }

        // Step 2: Generate embedding for the query
        const queryEmbedding = await getQueryEmbedding(message);

        // Step 3: Search for relevant documents
        const documents = await searchDocuments(queryEmbedding, {
            threshold: 0.5,
            count: 5
        });

        // Step 4: Format context and get citations
        const { contextText, citations } = formatContext(documents);

        // Step 5: Add tool result to context if available
        const fullContext = toolResult
            ? `LIVE BLOCKCHAIN DATA:\n${toolResult}\n\n---\n\nDOCUMENTATION:\n${contextText}`
            : contextText;

        // Step 6: Generate streaming response
        const result = await generateRAGResponse(message, fullContext, history);

        // Create a streaming response
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    // First, send citations and tool info as metadata
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({
                            type: 'metadata',
                            citations,
                            toolUsed: toolNeed ? toolNeed.tool : null,
                            toolResult: toolResult
                        })}\n\n`)
                    );

                    // Stream the response chunks
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
                            );
                        }
                    }

                    // Send done signal
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Streaming error' })}\n\n`)
                    );
                    controller.close();
                }
            }
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
