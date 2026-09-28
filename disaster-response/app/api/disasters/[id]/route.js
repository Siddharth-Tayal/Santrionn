import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { disasterParams, updateDisasterBody } from '@/lib/server/validation/disaster.schema';
import { getDisaster, updateDisaster, deleteDisaster } from '@/lib/server/services/disasters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(
  withValidation({ params: disasterParams })(async ({ params }) => ({
    data: await getDisaster(params.id),
  }))
);

export const PATCH = withHandler(
  withValidation({ params: disasterParams, body: updateDisasterBody })(async ({ params, body, user }) => ({
    data: await updateDisaster(params.id, body, user),
  })),
  { auth: true, roles: ['admin', 'contributor'] }
);

export const DELETE = withHandler(
  withValidation({ params: disasterParams })(async ({ params }) => ({
    data: await deleteDisaster(params.id),
  })),
  { auth: true, roles: ['admin'] }
);
