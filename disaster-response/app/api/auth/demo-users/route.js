import { withHandler } from '@/lib/server/middleware/withHandler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Demo credentials for the local evaluation environment. Passwords deliberately
 * left client-visible: these are fixtures created by `npm run seed`, not real
 * credentials. A real deployment would never ship them.
 */
export const GET = withHandler(async () => ({
  data: [
    { username: 'admin',       role: 'admin',       description: 'Full access, incl. DELETE /disasters/:id and reopen resolved incidents.' },
    { username: 'contributor', role: 'contributor', description: 'Can create and update disasters. Cannot delete or reopen resolved.' },
    { username: 'reliefops',   role: 'contributor', description: 'Second contributor account to demonstrate multi-author flows.' },
  ],
}));
