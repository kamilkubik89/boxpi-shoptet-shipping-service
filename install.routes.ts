import { Router } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../common/async-handler';
import { installQuerySchema } from './install.schemas';
import { shoptetService } from '../../services/shoptet.service';
import { shopService } from '../../services/shop.service';

export const installRouter = Router();

installRouter.get(
  '/shoptet',
  asyncHandler(async (req, res) => {
    const parsed = installQuerySchema.parse(req.query);
    const { oauthAccessToken } = await shoptetService.exchangeInstallCode({
      code: parsed.code,
      tokenUrl: parsed.tokenUrl
    });

    const shop = await shopService.upsertShop({
      eshopId: parsed.eshopId,
      domain: parsed.domain,
      oauthAccessToken,
      shippingMethodCode: env.SHOPTET_SHIPPING_METHOD_CODE
    });

    const signatureKey = await shoptetService.renewWebhookSignatureKey(shop);
    await shopService.setWebhookSignatureKey(shop.eshopId, signatureKey);

    await shoptetService.registerWebhook(shop, 'shippingRequest:confirmed', env.SHOPTET_WEBHOOK_URL);
    await shoptetService.registerWebhook(shop, 'shippingRequest:cancelled', env.SHOPTET_WEBHOOK_URL);
    await shoptetService.registerWebhook(shop, 'addon:terminate', env.SHOPTET_WEBHOOK_URL);

    res.status(200).send('Installation completed');
  })
);
