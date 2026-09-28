import { withHandler } from '@/lib/server/middleware/withHandler';
import { withValidation } from '@/lib/server/middleware/withValidation';
import { disasterIdParams } from '@/lib/server/validation/resource.schema';
import { z } from 'zod';
import { strictObject } from '@/lib/server/validation/common.schema';
import Disaster from '@/lib/server/models/Disaster';
import AppError from '@/lib/server/utils/AppError';
import { toObjectId } from '@/lib/server/utils/ids';
import { getReportsForDisaster } from '@/lib/server/services/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reportsQuery = strictObject({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const GET = withHandler(
  withValidation({ params: disasterIdParams, query: reportsQuery })(async ({ params, query }) => {
    const disaster = await Disaster.findById(toObjectId(params.id, 'disaster id')).lean();
    if (!disaster) throw AppError.notFound(`No disaster found with id ${params.id}`);
    const { data, meta } = await getReportsForDisaster(disaster, { limit: query.limit ?? 20 });
    return { data, meta };
  })
);
