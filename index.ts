import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import { env, allowedOrigins } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { installRouter } from './modules/install/install.routes';
import { shippingRouter } from './modules/shipping/shipping.routes';
import { webhooksRouter } from './modules/webhooks/webhooks.routes';
import { shopsRouter } from './modules/shops/shops.routes';
import { errorMiddleware, notFoundMiddleware } from './modules/common/error-middleware';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    }
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = Buffer.from(buf);
    }
  })
);
app.use(pinoHttp({ logger }));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.use('/api/install', installRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/shops', shopsRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started');
});
