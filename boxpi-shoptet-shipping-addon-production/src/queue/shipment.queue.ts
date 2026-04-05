import { Job, Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { shippingService } from '../services/shipping.service';
import { shopService } from '../services/shop.service';
import { shoptetService } from '../services/shoptet.service';

export interface ShipmentJobData {
  shippingRequestId: string;
}

export const shipmentQueue = new Queue<ShipmentJobData>('shipments', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30000
    },
    removeOnComplete: 1000,
    removeOnFail: 1000
  }
});

export async function enqueueShipmentJob(data: ShipmentJobData): Promise<void> {
  await shipmentQueue.add('create-shipment', data, {
    jobId: data.shippingRequestId
  });
}

export function createShipmentWorker(): Worker<ShipmentJobData> {
  return new Worker<ShipmentJobData>(
    'shipments',
    async (job: Job<ShipmentJobData>) => {
      const shippingRequest = await prisma.shippingRequest.findUnique({
        where: { id: job.data.shippingRequestId },
        include: { shop: true }
      });

      if (!shippingRequest) {
        logger.warn({ jobId: job.id }, 'Shipping request not found for worker job');
        return;
      }

      await prisma.shipmentJob.upsert({
        where: { shippingRequestId: shippingRequest.id },
        update: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
        create: { shippingRequestId: shippingRequest.id, status: 'PROCESSING', attempts: 1 }
      });

      try {
        if (!shippingRequest.orderCode) {
          throw new Error('Shipping request has no orderCode');
        }

        const shop = await shopService.getByEshopId(shippingRequest.shop.eshopId);
        if (!shop) throw new Error('Shop not found');

        const order = await shoptetService.getOrderDetail(shop, shippingRequest.orderCode);
        const shipment = await shippingService.createShipmentFromOrder({
          shippingRequestId: shippingRequest.id,
          order,
          carrier: shop.boxpiCarrier ?? undefined
        });

        if (shipment.trackingCode) {
          await shoptetService.upsertTrackingToOrder(shop, shippingRequest.orderCode, shipment.trackingCode, shipment.labelUrl);
        }

        await prisma.shipmentJob.update({
          where: { shippingRequestId: shippingRequest.id },
          data: { status: 'COMPLETED', lastError: null }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown worker error';
        await prisma.shipmentJob.update({
          where: { shippingRequestId: shippingRequest.id },
          data: { status: 'FAILED', lastError: message }
        });
        await prisma.shippingRequest.update({
          where: { id: shippingRequest.id },
          data: { status: 'FAILED', lastError: message }
        });
        logger.error({ err: error, shippingRequestId: shippingRequest.id }, 'Shipment worker failed');
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: env.JOB_CONCURRENCY
    }
  );
}
