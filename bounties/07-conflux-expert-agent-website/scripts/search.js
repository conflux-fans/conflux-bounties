/**
 * Vector Search for Conflux Documentation
 * 
 * Uses Gemini for query embedding and Supabase for similarity search
 */

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Configuration
const CONFIG = {
    model: 'text-embedding-004',
    matchThreshold: 0.5,   // Minimum similarity score
    matchCount: 5          // Number of results to return
};

// Validate environment
const requiredEnvVars = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: Missing environment variable ${envVar}`);
        process.exit(1);
    }
}

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: CONFIG.model });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate embedding for query text
 */
async function getQueryEmbedding(query) {
    const result = await embeddingModel.embedContent({
        content: { parts: [{ text: query }] }
    });
    return result.embedding.values;
}

/**
 * Search for similar documents
 */
async function search(query, options = {}) {
    const {
        threshold = CONFIG.matchThreshold,
        count = CONFIG.matchCount,
        section = null
    } = options;

    // Generate query embedding
    const queryEmbedding = await getQueryEmbedding(query);

    // Call Supabase match_documents function
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

/**
 * Format search results for display
 */
function formatResults(results) {
    if (!results || results.length === 0) {
        return 'No results found.';
    }

    return results.map((r, i) => {
        const similarity = (r.similarity * 100).toFixed(1);
        return `
${i + 1}. [${similarity}%] ${r.title}
   Section: ${r.section}
   URL: ${r.url}
   Content: ${r.content.slice(0, 200)}...
`;
    }).join('\n');
}

/**
 * Main CLI function
 */
async function main() {
    const query = process.argv.slice(2).join(' ');

    if (!query) {
        console.log('Usage: npm run search "your search query"');
        console.log('');
        console.log('Examples:');
        console.log('  npm run search "How to run a Conflux node"');
        console.log('  npm run search "What is eSpace"');
        console.log('  npm run search "gas fees transaction"');
        process.exit(0);
    }

    console.log('='.repeat(60));
    console.log('Conflux Documentation Search');
    console.log('='.repeat(60));
    console.log(`\nQuery: "${query}"\n`);

    try {
        const results = await search(query);
        console.log(`Found ${results.length} results:\n`);
        console.log(formatResults(results));
    } catch (error) {
        console.error('Search failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module
export { search, getQueryEmbedding };

// Run CLI if executed directly
main();
