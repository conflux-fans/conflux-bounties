/**
 * Supabase client for vector search
 */
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Search for similar documents in the vector store
 */
export async function searchDocuments(
    queryEmbedding: number[],
    options: {
        threshold?: number;
        count?: number;
        section?: string | null;
    } = {}
) {
    const { threshold = 0.5, count = 5, section = null } = options;

    const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: count,
        filter_section: section
    });

    if (error) {
        throw new Error(`Search error: ${error.message}`);
    }

    return data;
}
