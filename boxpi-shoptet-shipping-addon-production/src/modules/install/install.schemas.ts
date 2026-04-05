import { z } from 'zod';

export const installQuerySchema = z.object({
  code: z.string().min(1),
  eshopId: z.coerce.number(),
  domain: z.string().min(1),
  tokenUrl: z.string().url()
});
