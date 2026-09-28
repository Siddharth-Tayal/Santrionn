import { withHandler } from '@/lib/server/middleware/withHandler';
import User from '@/lib/server/models/User';
import AppError from '@/lib/server/utils/AppError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async ({ user }) => {
  if (!user) throw AppError.unauthorized();
  const doc = await User.findById(user.userId).lean();
  if (!doc) throw AppError.unauthorized();
  return {
    data: {
      user: {
        id: String(doc._id),
        username: doc.username,
        displayName: doc.displayName || null,
        role: doc.role,
        isAdmin: doc.role === 'admin',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    },
  };
});
