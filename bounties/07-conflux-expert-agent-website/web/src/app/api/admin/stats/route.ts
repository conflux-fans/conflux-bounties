/**
 * Admin API Routes - Stats and Sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Simple admin password check (basic auth as per bounty spec)
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

/**
 * GET /api/admin/stats - Get database statistics
 */
export async function GET(request: NextRequest) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
        });
    }

    try {
        // Get document count
        const { count: docCount, error: countError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        // Get section breakdown
        const { data: sections, error: sectionError } = await supabase
            .from('documents')
            .select('section')
            .limit(10000);

        if (sectionError) throw sectionError;

        // Count by section
        const sectionCounts: Record<string, number> = {};
        sections?.forEach(doc => {
            const section = doc.section || 'unknown';
            sectionCounts[section] = (sectionCounts[section] || 0) + 1;
        });

        // Get recent documents
        const { data: recent, error: recentError } = await supabase
            .from('documents')
            .select('doc_id, title, section, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        return NextResponse.json({
            totalDocuments: docCount || 0,
            sectionBreakdown: sectionCounts,
            recentDocuments: recent || [],
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
