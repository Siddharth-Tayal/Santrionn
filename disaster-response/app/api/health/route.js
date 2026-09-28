import mongoose from 'mongoose';
import { withHandler } from '@/lib/server/middleware/withHandler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(async () => ({
  data: {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  },
}));
