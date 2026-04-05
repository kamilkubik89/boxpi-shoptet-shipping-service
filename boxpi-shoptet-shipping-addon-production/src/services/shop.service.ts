import { Shop, ShopStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface UpsertShopInput {
  eshopId: number;
  domain: string;
  oauthAccessToken: string;
  shoptetApiBaseUrl?: string;
  webhookSignatureKey?: string;
  shippingMethodCode?: string;
}

export class ShopService {
  async upsertShop(input: UpsertShopInput): Promise<Shop> {
    return prisma.shop.upsert({
      where: { eshopId: input.eshopId },
      update: {
        domain: input.domain,
        oauthAccessToken: input.oauthAccessToken,
        shoptetApiBaseUrl: input.shoptetApiBaseUrl,
        webhookSignatureKey: input.webhookSignatureKey,
        shippingMethodCode: input.shippingMethodCode,
        status: ShopStatus.ACTIVE
      },
      create: {
        eshopId: input.eshopId,
        domain: input.domain,
        oauthAccessToken: input.oauthAccessToken,
        shoptetApiBaseUrl: input.shoptetApiBaseUrl,
        webhookSignatureKey: input.webhookSignatureKey,
        shippingMethodCode: input.shippingMethodCode
      }
    });
  }

  async getByEshopId(eshopId: number): Promise<Shop | null> {
    return prisma.shop.findUnique({ where: { eshopId } });
  }

  async getByDomain(domain: string): Promise<Shop | null> {
    return prisma.shop.findUnique({ where: { domain } });
  }

  async setWebhookSignatureKey(eshopId: number, signatureKey: string): Promise<Shop> {
    return prisma.shop.update({
      where: { eshopId },
      data: { webhookSignatureKey: signatureKey }
    });
  }
}

export const shopService = new ShopService();
