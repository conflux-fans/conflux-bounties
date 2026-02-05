/**
 * Search API Route - Direct vector search
 * 
 * POST /api/search
 * Body: { query: string, section?: string, limit?: number }
 * Returns: Array of matching documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueryEmbedding } from '@/lib/gemini';
import { searchDocuments } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { query, section, limit = 5 } = await request.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json(
                { error: 'Query is required' },
                { status: 400 }
            );
        }

        // Generate embedding for the query
        const queryEmbedding = await getQueryEmbedding(query);

        // Search for relevant documents
        const documents = await searchDocuments(queryEmbedding, {
            threshold: 0.5,
            count: limit,
            section: section || null
        });

        return NextResponse.json({
            query,
            results: documents.map((doc: {
                doc_id: string;
                title: string;
                section: string;
                url: string;
                content: string;
                similarity: number;
            }) => ({
                id: doc.doc_id,
                title: doc.title,
                section: doc.section,
                url: doc.url,
                content: doc.content,
                similarity: Math.round(doc.similarity * 100) / 100
            }))
        });

    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
