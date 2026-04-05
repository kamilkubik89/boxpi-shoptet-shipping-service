import { createShipmentWorker } from '../../queue/shipment.queue';
import { logger } from '../../lib/logger';

const worker = createShipmentWorker();

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Shipment job completed');
});

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Shipment job failed');
});
