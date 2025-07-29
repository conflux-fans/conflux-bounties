import { NextRequest, NextResponse } from 'next/server';
import { getAuditReportStats } from '@/lib/database';

interface StatsQuery {
  address?: string;
  timeRange?: string;
}

interface StatsResponse {
  global?: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
    totalFindings: number;
    avgFindings: number;
    avgProcessingTime: number;
    severityDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  address?: {
    address: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
    totalFindings: number;
    avgFindings: number;
    avgProcessingTime: number;
    severityDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  timestamp: string;
}

/**
 * Validate contract address format
 */
function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  if (trimmed.length < 10) return false;
  
  return trimmed.startsWith('cfx:') || trimmed.startsWith('0x');
}

/**
 * Validate time range parameter
 */
function validateTimeRange(timeRange: string): boolean {
  const validRanges = ['24h', '7d', '30d', '90d', '1y', 'all'];
  return validRanges.includes(timeRange);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const address = searchParams.get('address');
    const timeRange = searchParams.get('timeRange') || 'all';

    // Validate parameters
    if (address && !validateAddress(address)) {
      return NextResponse.json(
        { 
          error: 'Invalid contract address format',
          details: 'Address must start with "cfx:" or "0x" and be at least 10 characters long'
        },
        { status: 400 }
      );
    }

    if (!validateTimeRange(timeRange)) {
      return NextResponse.json(
        { 
          error: 'Invalid time range parameter',
          details: 'Time range must be one of: 24h, 7d, 30d, 90d, 1y, all'
        },
        { status: 400 }
      );
    }

    console.log(`[ReportsStats] Fetching stats - Address: ${address || 'all'}, Time range: ${timeRange}`);

    const response: StatsResponse = {
      timestamp: new Date().toISOString()
    };

    // Fetch global stats if no specific address
    if (!address) {
      try {
        const globalStats = await getAuditReportStats();
        if (globalStats) {
          response.global = globalStats;
        }
      } catch (error) {
        console.error('[ReportsStats] Error fetching global stats:', error);
        // Continue without global stats rather than failing
      }
    }

    // Fetch address-specific stats if address provided
    if (address) {
      try {
        const addressStats = await getAuditReportStats(address);
        if (addressStats) {
          response.address = {
            address,
            ...addressStats
          };
        }
      } catch (error) {
        console.error(`[ReportsStats] Error fetching stats for address ${address}:`, error);
        return NextResponse.json(
          { 
            error: 'Failed to fetch address statistics',
            details: 'An error occurred while retrieving statistics for the specified address'
          },
          { status: 500 }
        );
      }
    }

    // If we have no data at all, return empty stats
    if (!response.global && !response.address) {
      response.global = {
        total: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        totalFindings: 0,
        avgFindings: 0,
        avgProcessingTime: 0,
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      };
    }

    // Set cache headers - shorter cache for stats since they change frequently
    const cacheMaxAge = 60; // 1 minute
    const headers = {
      'Cache-Control': `public, max-age=${cacheMaxAge}, stale-while-revalidate=120`,
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('[ReportsStats] Error fetching statistics:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error occurred while fetching statistics',
        type: 'stats_error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Export types for use in other modules
export type { StatsQuery, StatsResponse };