/**
 * Generate Embeddings and Upload to Supabase
 * 
 * Uses Google Gemini API directly for text-embedding-004 model
 * Streams chunks and uploads directly to Supabase
 */

import fs from 'fs';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Configuration
const CONFIG = {
    inputFile: 'data/processed/chunks.json',
    batchSize: 100,      // Gemini supports up to 100 texts per batch
    model: 'text-embedding-004'  // Gemini embedding model (768 dimensions)
};

// Validate environment
const requiredEnvVars = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: Missing environment variable ${envVar}`);
        console.error('Make sure you have a .env file with all required variables');
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
 * Generate embeddings for a batch of texts using Gemini
 */
async function getEmbeddingsBatch(texts) {
    const result = await embeddingModel.batchEmbedContents({
        requests: texts.map(text => ({
            content: { parts: [{ text }] }
        }))
    });
    return result.embeddings.map(e => e.values);
}

/**
 * Upload chunks with embeddings to Supabase
 */
async function uploadToSupabase(chunks) {
    const records = chunks.map(chunk => ({
        doc_id: chunk.doc_id,
        chunk_index: chunk.chunk_index,
        title: chunk.title,
        section: chunk.section,
        url: chunk.url,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: chunk.embedding
    }));

    const { error } = await supabase
        .from('documents')
        .upsert(records, { onConflict: 'doc_id,chunk_index' });

    if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
    }
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
    console.log('='.repeat(60));
    console.log('Embedding Generation & Upload to Supabase');
    console.log('='.repeat(60));

    // Read chunks
    console.log(`\nReading: ${CONFIG.inputFile}`);
    const chunks = JSON.parse(fs.readFileSync(CONFIG.inputFile, 'utf-8'));
    console.log(`Found ${chunks.length} chunks to process`);

    console.log(`\nModel: Gemini ${CONFIG.model} (768 dimensions)`);
    console.log(`Batch size: ${CONFIG.batchSize}`);
    console.log(`Estimated batches: ${Math.ceil(chunks.length / CONFIG.batchSize)}`);

    // Process in batches
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < chunks.length; i += CONFIG.batchSize) {
        const batch = chunks.slice(i, i + CONFIG.batchSize);
        const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
        const totalBatches = Math.ceil(chunks.length / CONFIG.batchSize);

        try {
            // Get embeddings for batch
            const texts = batch.map(c => c.content);
            const embeddings = await getEmbeddingsBatch(texts);

            // Add embeddings to chunks
            for (let j = 0; j < batch.length; j++) {
                batch[j].embedding = embeddings[j];
            }

            // Upload to Supabase
            await uploadToSupabase(batch);

            processed += batch.length;
            console.log(`  Batch ${batchNum}/${totalBatches}: Processed ${processed}/${chunks.length} chunks`);

            // Rate limiting - Gemini has 1500 RPM for embedding, so 200ms is safe
            if (i + CONFIG.batchSize < chunks.length) {
                await sleep(200);
            }
        } catch (error) {
            console.error(`  Batch ${batchNum} error: ${error.message}`);
            errors++;

            // If too many errors, abort
            if (errors > 5) {
                console.error('\nToo many errors, aborting.');
                process.exit(1);
            }

            // Wait and retry
            await sleep(3000);
            i -= CONFIG.batchSize; // Retry this batch
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total chunks processed: ${processed}`);
    console.log(`Errors encountered: ${errors}`);
    console.log(`\nData uploaded to Supabase!`);
    console.log(`Check your Supabase dashboard: ${process.env.SUPABASE_URL}`);
}

main().catch(console.error);
