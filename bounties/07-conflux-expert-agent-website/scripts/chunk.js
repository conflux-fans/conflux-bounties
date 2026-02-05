/**
 * Chunk Documents for Vector Embedding (Using LangChain)
 * 
 * This script:
 * 1. Reads all_documents.json
 * 2. Uses LangChain's RecursiveCharacterTextSplitter
 * 3. Streams output to avoid memory issues
 */

import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// Configuration
const CONFIG = {
    inputFile: 'data/processed/all_documents.json',
    outputFile: 'data/processed/chunks.json',
    chunkSize: 1000,
    chunkOverlap: 200
};

async function main() {
    console.log('='.repeat(60));
    console.log('Document Chunking with LangChain');
    console.log('='.repeat(60));

    // Initialize text splitter
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CONFIG.chunkSize,
        chunkOverlap: CONFIG.chunkOverlap,
        separators: ['\n\n', '\n', '. ', ' ', '']
    });

    // Read input documents
    console.log(`\nReading: ${CONFIG.inputFile}`);
    const documents = JSON.parse(fs.readFileSync(CONFIG.inputFile, 'utf-8'));
    console.log(`Found ${documents.length} documents`);

    // Create output directory
    const outputDir = path.dirname(CONFIG.outputFile);
    fs.mkdirSync(outputDir, { recursive: true });

    // Open write stream
    const writeStream = fs.createWriteStream(CONFIG.outputFile);
    writeStream.write('[\n');

    let totalChunks = 0;
    let totalChars = 0;

    console.log('\nProcessing documents...');

    for (let docIndex = 0; docIndex < documents.length; docIndex++) {
        const doc = documents[docIndex];

        // Split document content
        const chunks = await splitter.splitText(doc.content);

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunkObj = {
                doc_id: doc.id,
                chunk_index: chunkIndex,
                title: doc.metadata.title,
                section: doc.metadata.section,
                url: doc.metadata.url,
                content: chunks[chunkIndex],
                metadata: {
                    ...doc.metadata,
                    chunk_index: chunkIndex,
                    total_chunks: chunks.length,
                    char_count: chunks[chunkIndex].length
                }
            };

            // Write with comma (except for first)
            const prefix = totalChunks === 0 ? '' : ',\n';
            writeStream.write(prefix + JSON.stringify(chunkObj));

            totalChunks++;
            totalChars += chunks[chunkIndex].length;
        }

        // Progress update every 50 docs
        if ((docIndex + 1) % 50 === 0) {
            console.log(`  Processed ${docIndex + 1}/${documents.length} documents...`);
        }
    }

    writeStream.write('\n]');
    writeStream.end();

    // Wait for stream to finish
    await new Promise((resolve) => writeStream.on('finish', resolve));

    // Statistics
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total chunks created: ${totalChunks}`);
    console.log(`Average chunks per doc: ${(totalChunks / documents.length).toFixed(1)}`);
    console.log(`Total content: ${(totalChars / 1000).toFixed(1)}k characters`);
    console.log(`Average chunk size: ${Math.round(totalChars / totalChunks)} characters`);
    console.log(`\nOutput saved to: ${CONFIG.outputFile}`);
}

main().catch(console.error);
