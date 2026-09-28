import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { loginBody } from '@/lib/server/validation/auth.schema';
import User from '@/lib/server/models/User';
import AppError from '@/lib/server/utils/AppError';
import { signAccessToken } from '@/lib/server/auth/jwt';
import { buildAuthCookie, buildCsrfCookie, generateCsrfToken } from '@/lib/server/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withHandler(
  withValidation({ body: loginBody })(async ({ body }) => {
    const user = await User.authenticate(body.username, body.password);
    if (!user) throw AppError.unauthorized('Invalid credentials');

    const accessToken = signAccessToken(user);
    const csrfToken = generateCsrfToken();

    return {
      data: {
        user: {
          id: String(user._id),
          username: user.username,
          displayName: user.displayName || null,
          role: user.role,
          isAdmin: user.role === 'admin',
        },
        csrfToken,
      },
      cookies: [buildAuthCookie(accessToken), buildCsrfCookie(csrfToken)],
    };
  }),
  { rateBucket: 'auth', skipCsrf: true }
);
