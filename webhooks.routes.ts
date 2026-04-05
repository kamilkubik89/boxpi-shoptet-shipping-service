import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../common/async-handler';
import { shopService } from '../../services/shop.service';
import { shoptetService } from '../../services/shoptet.service';
import { HttpError } from '../common/http-error';
import { enqueueShipmentJob } from '../../queue/shipment.queue';
import { shippingService } from '../../services/shipping.service';

export const webhooksRouter = Router();

webhooksRouter.post(
  '/shoptet',
  asyncHandler(async (req, res) => {
    const payload = req.body as { eshopId: number; event: string; eventInstance: string };
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.header('Shoptet-Webhook-Signature') ?? undefined;

    const shop = await shopService.getByEshopId(payload.eshopId);
    if (!shop) throw new HttpError(404, 'Shop not found');

    if (!rawBody || !shoptetService.verifyWebhookSignature(rawBody, shop.webhookSignatureKey, signature)) {
      throw new HttpError(401, 'Invalid webhook signature');
    }

    const notification = await prisma.webhookNotification.upsert({
      where: {
        event_eventInstance: {
          event: payload.event,
          eventInstance: payload.eventInstance
        }
      },
      update: {},
      create: {
        shopId: shop.id,
        event: payload.event,
        eventInstance: payload.eventInstance,
        payload: payload as any
      }
    });

    res.status(200).json({ ok: true });

    if (notification.processed) return;

    if (payload.event === 'shippingRequest:confirmed') {
      const request = await shippingService.markConfirmedByEvent(payload.eventInstance);
      await enqueueShipmentJob({ shippingRequestId: request.id });
    }

    if (payload.event === 'shippingRequest:cancelled') {
      await shippingService.markCancelledByEvent(payload.eventInstance);
    }

    if (payload.event === 'addon:terminate') {
      await prisma.shop.update({ where: { id: shop.id }, data: { status: 'UNINSTALLED' } });
    }

    await prisma.webhookNotification.update({
      where: { id: notification.id },
      data: {
        processed: true,
        processedAt: new Date()
      }
    });
  })
);
