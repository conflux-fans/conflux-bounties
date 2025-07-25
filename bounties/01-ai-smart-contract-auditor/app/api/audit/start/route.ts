import { NextRequest, NextResponse } from 'next/server';
import { startAudit } from '@/lib/analysisEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Contract address is required' },
        { status: 400 }
      );
    }

    // Basic address validation
    if (!address.startsWith('cfx:') && !address.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Invalid contract address format. Address should start with "cfx:" or "0x"' },
        { status: 400 }
      );
    }

    if (address.length < 10) {
      return NextResponse.json(
        { error: 'Contract address appears to be too short' },
        { status: 400 }
      );
    }

    const jobId = await startAudit(address.trim());
    
    return NextResponse.json({ 
      jobId,
      message: 'Audit started successfully',
      status: 'pending'
    });
  } catch (error) {
    console.error('Error starting audit:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to start audit: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error occurred while starting the audit' },
      { status: 500 }
    );
  }
}