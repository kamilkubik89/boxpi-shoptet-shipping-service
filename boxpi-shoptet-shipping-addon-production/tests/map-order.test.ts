import { describe, expect, it } from 'vitest';
import { shippingService } from '../src/services/shipping.service';

describe('mapOrderToBoxpi', () => {
  it('maps pickup point order payload', () => {
    const payload = shippingService.mapOrderToBoxpi(
      {
        code: '20250001',
        order: {
          currency: { code: 'EUR' },
          price: { withVat: 12.9 },
          customer: { fullName: 'John Doe', phone: '+421900000000', email: 'john@example.com' },
          deliveryAddress: { countryCode: 'SK' }
        }
      },
      'PACKETA123',
      'PACKETA-POINT-SK'
    ) as any;

    expect(payload.Packages[0].Recipient.PickupPoint).toBe('PACKETA123');
    expect(payload.Packages[0].Carrier).toBe('PACKETA-POINT-SK');
  });
});
