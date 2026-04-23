/**
 * Analytics API Route
 * 
 * POST /api/analytics -> Track client-side analytics events
 * Events are sent to the queue for async processing.
 */

import { getEnv } from '@/lib/cloudflare';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const env = getEnv();
  const body = await request.json() as { event?: string; data?: Record<string, string> };
  const { event, data = {} } = body;

  if (!event) {
    return Response.json({ error: 'event required' }, { status: 400 });
  }

  try {
    // Write directly to Analytics Engine for immediate data
    env.ANALYTICS.writeDataPoint({
      blobs: [event, data.path || '', data.referrer || ''],
      doubles: [],
      indexes: ['store'],
    });

    return Response.json({ tracked: true });
  } catch (err) {
    console.error('Analytics error:', err);
    return Response.json({ tracked: false }, { status: 500 });
  }
}
