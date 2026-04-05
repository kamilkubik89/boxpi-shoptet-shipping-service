export interface ShoptetWebhookPayload {
  eshopId: number;
  event: string;
  eventCreated: string;
  eventInstance: string;
}

export interface ShoptetTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface ShoptetShippingStatusResponse {
  status: 'open' | 'completed' | 'cancelled';
  orderCode: string | null;
}
