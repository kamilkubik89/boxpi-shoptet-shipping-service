import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { Shop } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { HttpError } from '../modules/common/http-error';
import { ShoptetTokenResponse } from '../types/shoptet';

interface ApiEnvelope<T> {
  data: T;
  errors: unknown;
  metadata?: Record<string, unknown>;
}

export class ShoptetService {
  private getApiClient(apiToken: string, baseURL = env.SHOPTET_API_BASE_URL): AxiosInstance {
    return axios.create({
      baseURL,
      timeout: env.HTTP_TIMEOUT_MS,
      headers: {
        'Shoptet-Access-Token': apiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    });
  }

  async exchangeInstallCode(payload: { code: string; tokenUrl: string }): Promise<{ oauthAccessToken: string }> {
    const response = await axios.get(payload.tokenUrl, {
      timeout: env.SHOPTET_INSTALL_TIMEOUT_MS,
      params: { code: payload.code }
    });

    const oauthAccessToken = response.data?.access_token ?? response.data?.oauthAccessToken;
    if (!oauthAccessToken) {
      throw new HttpError(502, 'Shoptet install token exchange failed', response.data);
    }

    return { oauthAccessToken };
  }

  async getApiAccessToken(shop: Shop): Promise<string> {
    const tokenUrl = `https://${shop.domain}/action/ApiOAuthServer/getAccessToken`;
    const { data } = await axios.get<ShoptetTokenResponse>(tokenUrl, {
      timeout: env.HTTP_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${shop.oauthAccessToken}`
      }
    });

    if (!data.access_token) {
      throw new HttpError(502, 'Shoptet API token exchange failed', data);
    }

    return data.access_token;
  }

  async registerWebhook(shop: Shop, event: string, url: string): Promise<void> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    await client.post('/api/webhooks', {
      data: [{ event, url }]
    });
  }

  async renewWebhookSignatureKey(shop: Shop): Promise<string> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    const { data } = await client.post<ApiEnvelope<{ signatureKey: string }>>('/api/webhooks/renew-signature-key');
    const key = data?.data?.signatureKey;
    if (!key) {
      throw new HttpError(502, 'Shoptet did not return webhook signature key', data);
    }
    return key;
  }

  verifyWebhookSignature(rawBody: Buffer, signatureKey: string | null | undefined, incomingSignature: string | undefined): boolean {
    if (!signatureKey || !incomingSignature) return false;
    const calculated = crypto.createHmac('sha1', signatureKey).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(incomingSignature));
    } catch {
      return false;
    }
  }

  async getShippingRequestStatus(shop: Shop, shippingRequestCode: string, shippingGuid: string): Promise<{ status: string; orderCode: string | null }> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    const { data } = await client.get<ApiEnvelope<{ status: string; orderCode: string | null }>>(
      `/api/shipping-request/${encodeURIComponent(shippingRequestCode)}/${encodeURIComponent(shippingGuid)}/status`
    );
    return data.data;
  }

  async updateShippingRequest(
    shop: Shop,
    shippingRequestCode: string,
    shippingGuid: string,
    payload: Record<string, unknown>
  ): Promise<{ verificationCode?: string }> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    const { data } = await client.put<ApiEnvelope<{ verificationCode?: string }>>(
      `/api/shipping-request/${encodeURIComponent(shippingRequestCode)}/${encodeURIComponent(shippingGuid)}`,
      payload
    );

    return data.data ?? {};
  }

  async getOrderDetail(shop: Shop, orderCode: string): Promise<any> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    const { data } = await client.get<ApiEnvelope<any>>(`/api/orders/${encodeURIComponent(orderCode)}`);
    return data.data;
  }

  async upsertTrackingToOrder(shop: Shop, orderCode: string, trackingCode: string, trackingUrl?: string): Promise<void> {
    const token = await this.getApiAccessToken(shop);
    const client = this.getApiClient(token);
    const remarks = trackingUrl ? `Tracking: ${trackingCode} (${trackingUrl})` : `Tracking: ${trackingCode}`;
    await client.patch(`/api/orders/${encodeURIComponent(orderCode)}/remarks`, {
      data: { remarks }
    }).catch((error) => {
      logger.warn({ error: error.response?.data ?? error.message, orderCode }, 'Unable to update order remarks with tracking');
    });
  }
}

export const shoptetService = new ShoptetService();
