import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { createDisasterBody, listDisastersQuery } from '@/lib/server/validation/disaster.schema';
import { listDisasters, createDisaster } from '@/lib/server/services/disasters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(
  withValidation({ query: listDisastersQuery })(async ({ query }) => {
    return listDisasters(query);
  })
);

export const POST = withHandler(
  withValidation({ body: createDisasterBody })(async ({ body, user }) => {
    const created = await createDisaster(body, user);
    return {
      data: created,
      status: 201,
      extraHeaders: { Location: `/api/disasters/${created.id}` },
    };
  }),
  { auth: true, roles: ['admin', 'contributor'] }
);
