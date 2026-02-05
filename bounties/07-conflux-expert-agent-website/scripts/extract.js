/**
 * Extract and Clean Conflux Documentation
 * 
 * This script:
 * 1. Reads all .md/.mdx files from general/ and espace/ folders
 * 2. Extracts frontmatter metadata
 * 3. Cleans content (removes MDX components, imports, etc.)
 * 4. Outputs clean markdown files + combined JSON
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

// Configuration
const CONFIG = {
    sourceDir: 'data/raw/conflux-docs/docs',
    outputDir: 'data/processed',
    folders: ['general', 'espace'],
    baseUrl: 'https://doc.confluxnetwork.org/docs'
};

/**
 * Clean MDX content - remove imports, components, and format for RAG
 */
function cleanContent(content, filePath) {
    let cleaned = content;

    // Remove import statements
    cleaned = cleaned.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    cleaned = cleaned.replace(/^import\s+.*?;?\s*$/gm, '');

    // Remove MDX/JSX components (Tabs, TabItem, etc.)
    // Handle self-closing tags
    cleaned = cleaned.replace(/<[A-Z][a-zA-Z]*\s*\/>/g, '');
    // Handle opening/closing tags with content (multi-line)
    cleaned = cleaned.replace(/<([A-Z][a-zA-Z]*)[^>]*>[\s\S]*?<\/\1>/g, (match, tagName) => {
        // For Tabs/TabItem, try to extract text content
        if (tagName === 'Tabs' || tagName === 'TabItem') {
            // Extract any text/markdown content from inside
            const innerContent = match.replace(/<[^>]+>/g, '').trim();
            return innerContent || '';
        }
        return '';
    });
    // Handle remaining opening tags
    cleaned = cleaned.replace(/<[A-Z][a-zA-Z]*[^>]*>/g, '');
    // Handle remaining closing tags
    cleaned = cleaned.replace(/<\/[A-Z][a-zA-Z]*>/g, '');

    // Convert Docusaurus admonitions to plain text
    // :::tip, :::note, :::warning, :::caution, :::danger, :::info
    cleaned = cleaned.replace(/^:::(tip|note|warning|caution|danger|info)\s*$/gm, '\n**$1:**\n');
    cleaned = cleaned.replace(/^:::$/gm, '');

    // Remove iframe embeds but keep a note about video
    cleaned = cleaned.replace(/<iframe[^>]*youtube[^>]*>[\s\S]*?<\/iframe>/gi, '[Video content available on YouTube]');
    cleaned = cleaned.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');

    // Clean up relative links - convert to descriptive text
    // Keep the link text but simplify the path
    cleaned = cleaned.replace(/\[([^\]]+)\]\(\.\.?\/[^)]+\)/g, '[$1]');

    // Remove HTML comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // Remove excessive blank lines (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Generate URL from file path
 */
function generateUrl(filePath, section) {
    // Remove extension and convert to URL path
    let urlPath = filePath
        .replace(/\.(md|mdx)$/, '')
        .replace(/\\/g, '/');

    // Handle index files
    if (urlPath.endsWith('/index')) {
        urlPath = urlPath.replace('/index', '');
    }

    return `${CONFIG.baseUrl}/${section}/${urlPath}`;
}

/**
 * Generate a unique ID from file path
 */
function generateId(filePath, section) {
    return `${section}-${filePath}`
        .replace(/\.(md|mdx)$/, '')
        .replace(/[\/\\]/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .toLowerCase();
}

/**
 * Process a single markdown file
 */
function processFile(fullPath, relativePath, section) {
    const fileContent = fs.readFileSync(fullPath, 'utf-8');

    // Parse frontmatter
    const { data: frontmatter, content } = matter(fileContent);

    // Clean the content
    const cleanedContent = cleanContent(content, relativePath);

    // Skip if content is too short (likely just imports/components)
    if (cleanedContent.length < 50) {
        console.log(`  Skipping (too short): ${relativePath}`);
        return null;
    }

    // Build metadata
    const metadata = {
        id: generateId(relativePath, section),
        title: frontmatter.title || path.basename(relativePath, path.extname(relativePath)),
        description: frontmatter.description || '',
        keywords: frontmatter.keywords || [],
        tags: frontmatter.tags || [],
        section: section,
        url: generateUrl(relativePath, section),
        filePath: relativePath,
        source: 'conflux-documentation'
    };

    return {
        metadata,
        content: cleanedContent,
        // Also create clean markdown with frontmatter for individual files
        markdown: `---
title: "${metadata.title}"
description: "${metadata.description}"
url: "${metadata.url}"
source: "${metadata.source}"
section: "${metadata.section}"
keywords: ${JSON.stringify(metadata.keywords)}
---

${cleanedContent}`
    };
}

/**
 * Process all files in a folder
 */
async function processFolder(section) {
    const folderPath = path.join(CONFIG.sourceDir, section);

    // Find all markdown files
    const pattern = path.join(folderPath, '**/*.{md,mdx}').replace(/\\/g, '/');
    const files = await glob(pattern);

    console.log(`\nProcessing ${section}/: Found ${files.length} files`);

    const results = [];

    for (const fullPath of files) {
        const relativePath = path.relative(folderPath, fullPath);

        // Skip template files
        if (relativePath.includes('templates')) {
            console.log(`  Skipping template: ${relativePath}`);
            continue;
        }

        // Skip files starting with underscore (drafts)
        if (path.basename(relativePath).startsWith('_')) {
            console.log(`  Skipping draft: ${relativePath}`);
            continue;
        }

        try {
            const result = processFile(fullPath, relativePath, section);
            if (result) {
                results.push(result);
                console.log(`  ✓ Processed: ${relativePath}`);
            }
        } catch (error) {
            console.error(`  ✗ Error processing ${relativePath}:`, error.message);
        }
    }

    return results;
}

/**
 * Save processed files
 */
function saveResults(results, section) {
    const outputDir = path.join(CONFIG.outputDir, section);

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Save individual markdown files
    for (const result of results) {
        const outputPath = path.join(outputDir, result.metadata.filePath.replace(/\.(md|mdx)$/, '.md'));
        const outputFileDir = path.dirname(outputPath);

        fs.mkdirSync(outputFileDir, { recursive: true });
        fs.writeFileSync(outputPath, result.markdown);
    }

    console.log(`  Saved ${results.length} markdown files to ${outputDir}/`);
}

/**
 * Main function
 */
async function main() {
    console.log('='.repeat(60));
    console.log('Conflux Documentation Extraction & Cleaning');
    console.log('='.repeat(60));

    const allResults = [];

    for (const section of CONFIG.folders) {
        const results = await processFolder(section);
        saveResults(results, section);
        allResults.push(...results);
    }

    // Save combined JSON (for RAG pipeline)
    const allDocuments = allResults.map(r => ({
        id: r.metadata.id,
        metadata: r.metadata,
        content: r.content
    }));

    const outputPath = path.join(CONFIG.outputDir, 'all_documents.json');
    fs.writeFileSync(outputPath, JSON.stringify(allDocuments, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total documents processed: ${allResults.length}`);
    console.log(`Output directory: ${CONFIG.outputDir}/`);
    console.log(`Combined JSON: ${outputPath}`);

    // Print some stats
    const totalChars = allResults.reduce((sum, r) => sum + r.content.length, 0);
    const avgChars = Math.round(totalChars / allResults.length);
    console.log(`Total content: ${(totalChars / 1000).toFixed(1)}k characters`);
    console.log(`Average per doc: ${avgChars} characters`);
}

main().catch(console.error);
