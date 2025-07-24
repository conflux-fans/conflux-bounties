import { NextRequest, NextResponse } from 'next/server';
import { startAudit } from '../../../lib/analysisEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const jobId = await startAudit(address);
    
    return NextResponse.json({ jobId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}