import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { nearbyQuery, disasterIdParams } from '@/lib/server/validation/resource.schema';
import { nearbyResources } from '@/lib/server/services/disasters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withHandler(
  withValidation({ params: disasterIdParams, query: nearbyQuery })(async ({ params, query }) => {
    return nearbyResources(params.id, query);
  })
);
