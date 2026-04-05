import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { prisma } from '../../lib/prisma';

export const shopsRouter = Router();

shopsRouter.get(
  '/:eshopId',
  asyncHandler(async (req, res) => {
    const eshopId = Number(req.params.eshopId);
    const shop = await prisma.shop.findUnique({
      where: { eshopId },
      include: {
        shippingRequests: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
    res.json({ shop });
  })
);
