import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const { url, events, secret } = await req.json();

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'url and events array are required' }, { status: 400 });
    }

    const validEvents = ['completed', 'failed', 'all'];
    const invalid = events.find((e: string) => !validEvents.includes(e) && e !== 'all');
    if (invalid) {
      return NextResponse.json({ error: `Invalid event: ${invalid}` }, { status: 400 });
    }

    const webhook = await prisma.webhookConfig.create({
      data: {
        url,
        events,
        secret: secret || null,
      },
    });

    return NextResponse.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      createdAt: webhook.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Webhook config error:', error);
    return NextResponse.json({ error: 'Failed to configure webhook' }, { status: 500 });
  }
}

export async function GET() {
  const webhooks = await prisma.webhookConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(webhooks);
}
