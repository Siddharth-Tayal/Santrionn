import { withHandler } from '@/lib/server/middleware/withHandler';
import { clearedCookie } from '@/lib/server/auth/cookies';
import config from '@/lib/server/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(
  async () => ({
    data: { ok: true },
    cookies: [clearedCookie(config.AUTH_COOKIE_NAME), clearedCookie(config.CSRF_COOKIE_NAME)],
  }),
  { skipCsrf: true }
);
