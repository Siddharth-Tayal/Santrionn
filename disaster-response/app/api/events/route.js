import { subscribe } from '@/lib/server/services/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE stream. Public read (no auth) so a curl demo works — flip `auth: true`
 * in withHandler here if you want to restrict.
 */
export async function GET() {
  const stream = subscribe();
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
