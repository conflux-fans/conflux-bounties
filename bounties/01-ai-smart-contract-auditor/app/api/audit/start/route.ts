import { NextRequest, NextResponse } from 'next/server';
import { runAudit, AuditProgress, Report } from '@/lib/analysisEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, format = 'json' } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Contract address is required' },
        { status: 400 }
      );
    }

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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendData = (data: any) => {
          const message = format === 'text' 
            ? `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
            : `${JSON.stringify(data)}\n`;
          
          controller.enqueue(encoder.encode(message));
        };

        sendData({
          type: 'start',
          timestamp: new Date().toISOString(),
          message: 'Starting smart contract audit...',
          address: address.trim()
        });

        try {
          const progressCallback = (progress: AuditProgress) => {
            sendData({
              type: 'progress',
              stage: progress.stage,
              progress: progress.progress,
              message: progress.message,
              timestamp: progress.timestamp.toISOString(),
              data: progress.data
            });
          };

          console.log(`[AuditStream] Starting audit for address: ${address}`);
          
          const report: Report = await runAudit(address.trim(), { 
            onProgress: progressCallback 
          });

          sendData({
            type: 'complete',
            timestamp: new Date().toISOString(),
            message: 'Audit completed successfully',
            report: {
              id: report.id,
              summary: report.summary,
              findings: report.findings,
              json: report.json,
              markdown: report.markdown
            }
          });

          console.log(`[AuditStream] Audit completed for address: ${address}`);

        } catch (error) {
          console.error(`[AuditStream] Audit failed for address: ${address}`, error);
          
          sendData({
            type: 'error',
            timestamp: new Date().toISOString(),
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            error: {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: error instanceof Error ? error.message : String(error)
            }
          });
        } finally {
          controller.close();
        }
      }
    });

    const headers = new Headers({
      'Content-Type': format === 'text' ? 'text/event-stream' : 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    if (format === 'text') {
      headers.set('X-Accel-Buffering', 'no'); 
    }

    return new Response(stream, { headers });

  } catch (error) {
    console.error('Error in audit stream setup:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error occurred while starting the audit',
        type: 'setup_error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Contract address is required as query parameter' },
      { status: 400 }
    );
  }

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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (eventType: string, data: any) => {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      sendEvent('start', {
        timestamp: new Date().toISOString(),
        message: 'Starting smart contract audit...',
        address: address.trim()
      });

      try {
        const progressCallback = (progress: AuditProgress) => {
          sendEvent('progress', {
            stage: progress.stage,
            progress: progress.progress,
            message: progress.message,
            timestamp: progress.timestamp.toISOString(),
            data: progress.data
          });
        };

        console.log(`[AuditSSE] Starting audit for address: ${address}`);
        
        const report: Report = await runAudit(address.trim(), { 
          onProgress: progressCallback 
        });

        sendEvent('complete', {
          timestamp: new Date().toISOString(),
          message: 'Audit completed successfully',
          report: {
            id: report.id,
            summary: report.summary,
            findings: report.findings,
            json: report.json,
            markdown: report.markdown
          }
        });

        console.log(`[AuditSSE] Audit completed for address: ${address}`);

      } catch (error) {
        console.error(`[AuditSSE] Audit failed for address: ${address}`, error);
        
        sendEvent('error', {
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          error: {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error)
          }
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    }
  });
}