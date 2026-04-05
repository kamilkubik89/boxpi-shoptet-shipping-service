import { Router } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../common/async-handler';
import { pickupPointsQuerySchema, quoteShippingSchema } from './shipping.schemas';
import { shopService } from '../../services/shop.service';
import { boxpiService } from '../../services/boxpi.service';
import { shippingService } from '../../services/shipping.service';
import { shoptetService } from '../../services/shoptet.service';
import { HttpError } from '../common/http-error';

export const shippingRouter = Router();

shippingRouter.get(
  '/pickup-points',
  asyncHandler(async (req, res) => {
    const query = pickupPointsQuerySchema.parse(req.query);
    const shop = await shopService.getByEshopId(query.eshopId);
    if (!shop) throw new HttpError(404, 'Shop not installed');

    const carrier = query.carrier ?? shop.boxpiCarrier ?? env.DEFAULT_PICKUP_CARRIER;
    const points = await boxpiService.getPickupPoints(carrier);
    res.json({ points });
  })
);

shippingRouter.post(
  '/quote',
  asyncHandler(async (req, res) => {
    const input = quoteShippingSchema.parse(req.body);
    const shop = await shopService.getByEshopId(input.eshopId);
    if (!shop) throw new HttpError(404, 'Shop not installed');

    const request = await shippingService.quoteShipping({
      shopId: shop.id,
      shippingRequestCode: input.shippingRequestCode,
      shippingGuid: input.shippingGuid,
      pickupPointId: input.pickupPointId,
      pickupPointRaw: input.pickupPoint,
      priceVatIncl: input.priceVatIncl ?? '0',
      currency: input.currency ?? env.BOXPI_DEFAULT_COD_CURRENCY
    });

    const response = await shoptetService.updateShippingRequest(shop, input.shippingRequestCode, input.shippingGuid, {
      data: {
        shippingMethodCode: shop.shippingMethodCode ?? env.SHOPTET_SHIPPING_METHOD_CODE,
        price: {
          withVat: input.priceVatIncl ?? '0',
          currency: input.currency ?? env.BOXPI_DEFAULT_COD_CURRENCY
        },
        label: input.pickupPoint ? `Pickup: ${String((input.pickupPoint as any).name ?? input.pickupPointId ?? '')}` : 'Delivery',
        expiration: request.expiresAt?.toISOString()
      }
    });

    if (response.verificationCode) {
      await (await import('../../lib/prisma')).prisma.shippingRequest.update({
        where: { id: request.id },
        data: { verificationCode: response.verificationCode }
      });
    }

    res.status(200).json({
      ok: true,
      verificationCode: response.verificationCode ?? null,
      expiresAt: request.expiresAt
    });
  })
);

shippingRouter.get(
  '/status/:shippingRequestCode/:shippingGuid',
  asyncHandler(async (req, res) => {
    const eshopId = Number(req.query.eshopId);
    if (!eshopId) throw new HttpError(400, 'eshopId is required');
    const shop = await shopService.getByEshopId(eshopId);
    if (!shop) throw new HttpError(404, 'Shop not installed');

    const data = await shoptetService.getShippingRequestStatus(shop, req.params.shippingRequestCode, req.params.shippingGuid);
    res.json(data);
  })
);
