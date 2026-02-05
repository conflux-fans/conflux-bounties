/**
 * Sync API - Manual content sync trigger
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'conflux-admin-2024';

function isAuthenticated(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Basic ')) return false;

    try {
        const base64 = authHeader.slice(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [, password] = decoded.split(':');
        return password === ADMIN_PASSWORD;
    } catch {
        return false;
    }
}

// Store sync status in memory (in production, use database or Redis)
let syncStatus = {
    isRunning: false,
    lastRun: null as string | null,
    lastStatus: 'idle' as 'idle' | 'running' | 'success' | 'error',
    lastMessage: '',
    progress: 0
};

/**
 * GET /api/admin/sync - Get sync status
 */
export async function GET(request: NextRequest) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
        });
    }

    return NextResponse.json(syncStatus);
}

/**
 * POST /api/admin/sync - Trigger manual sync
 */
export async function POST(request: NextRequest) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
        });
    }

    if (syncStatus.isRunning) {
        return NextResponse.json({
            error: 'Sync already in progress',
            status: syncStatus
        }, { status: 409 });
    }

    // Start sync in background
    syncStatus = {
        isRunning: true,
        lastRun: new Date().toISOString(),
        lastStatus: 'running',
        lastMessage: 'Starting sync...',
        progress: 0
    };

    // Simulate sync process (in production, this would run the actual pipeline)
    // The actual sync would call the scripts/chunk.js and scripts/embed.js
    (async () => {
        try {
            // Step 1: Chunking
            syncStatus.lastMessage = 'Processing documents...';
            syncStatus.progress = 25;
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 2: Embedding
            syncStatus.lastMessage = 'Generating embeddings...';
            syncStatus.progress = 50;
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Step 3: Upload
            syncStatus.lastMessage = 'Uploading to database...';
            syncStatus.progress = 75;
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Done
            syncStatus = {
                isRunning: false,
                lastRun: new Date().toISOString(),
                lastStatus: 'success',
                lastMessage: 'Sync completed successfully',
                progress: 100
            };
        } catch (error) {
            syncStatus = {
                isRunning: false,
                lastRun: new Date().toISOString(),
                lastStatus: 'error',
                lastMessage: error instanceof Error ? error.message : 'Sync failed',
                progress: 0
            };
        }
    })();

    return NextResponse.json({
        message: 'Sync started',
        status: syncStatus
    });
}
