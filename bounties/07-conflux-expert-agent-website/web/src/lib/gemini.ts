/**
 * Gemini AI client for embeddings and chat
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Models
export const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
export const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

/**
 * Generate embedding for a query
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
    const result = await embeddingModel.embedContent({
        content: { parts: [{ text: query }] }
    });
    return result.embedding.values;
}

/**
 * System prompt for the Conflux Expert Agent
 */
export const SYSTEM_PROMPT = `You are a Conflux Expert Agent - a helpful AI assistant specialized in Conflux blockchain technology.

Your role:
- Answer questions about Conflux Network, eSpace, Core Space, and related technologies
- Provide accurate, technical information based on the official documentation
- Always cite your sources using [1], [2] format when referencing documentation
- If you're unsure about something, say so rather than making things up
- Be concise but thorough in your explanations

Guidelines:
- Use the provided context from Conflux documentation to answer questions
- When providing code examples, use proper syntax highlighting
- Explain concepts at an appropriate technical level
- If the question is outside your knowledge or context, acknowledge this

Remember: You have access to official Conflux documentation. Always reference it when answering.`;

/**
 * Format context documents for the prompt
 */
export function formatContext(documents: Array<{
    content: string;
    title: string;
    url: string;
    similarity: number;
}>): { contextText: string; citations: Array<{ index: number; title: string; url: string }> } {
    const citations: Array<{ index: number; title: string; url: string }> = [];

    const contextText = documents.map((doc, index) => {
        citations.push({
            index: index + 1,
            title: doc.title,
            url: doc.url
        });
        return `[${index + 1}] ${doc.title}\n${doc.content}`;
    }).join('\n\n---\n\n');

    return { contextText, citations };
}

/**
 * Generate a chat response with RAG
 */
export async function generateRAGResponse(
    query: string,
    contextText: string,
    conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = []
) {
    const chat = chatModel.startChat({
        history: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: 'I understand. I am a Conflux Expert Agent ready to help with blockchain-related questions using the official documentation.' }] },
            ...conversationHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }))
        ]
    });

    const prompt = `Based on the following Conflux documentation context, answer the user's question. 
Always cite your sources using the reference numbers provided (e.g., [1], [2]).

CONTEXT:
${contextText}

USER QUESTION: ${query}

Provide a helpful, accurate answer with proper citations:`;

    const result = await chat.sendMessageStream(prompt);

    return result;
}

