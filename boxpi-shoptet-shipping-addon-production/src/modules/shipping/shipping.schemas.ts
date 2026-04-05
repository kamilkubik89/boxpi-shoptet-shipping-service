import { z } from 'zod';

export const quoteShippingSchema = z.object({
  eshopId: z.coerce.number(),
  shippingRequestCode: z.string().min(1),
  shippingGuid: z.string().min(1),
  pickupPointId: z.string().min(1).optional(),
  pickupPoint: z.any().optional(),
  priceVatIncl: z.string().optional(),
  currency: z.string().optional()
});

export const pickupPointsQuerySchema = z.object({
  eshopId: z.coerce.number(),
  carrier: z.string().optional()
});
