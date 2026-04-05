import { Prisma, ShippingRequestStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { HttpError } from '../modules/common/http-error';
import { boxpiService } from './boxpi.service';

interface QuoteInput {
  shopId: string;
  shippingRequestCode: string;
  shippingGuid: string;
  pickupPointId?: string;
  pickupPointRaw?: unknown;
  priceVatIncl?: string;
  currency?: string;
}

export class ShippingService {
  async quoteShipping(input: QuoteInput) {
    const shippingRequest = await prisma.shippingRequest.upsert({
      where: {
        shippingRequestCode_shippingGuid: {
          shippingRequestCode: input.shippingRequestCode,
          shippingGuid: input.shippingGuid
        }
      },
      update: {
        status: ShippingRequestStatus.OFFERED,
        selectedPickupPointId: input.pickupPointId,
        selectedPickupRaw: input.pickupPointRaw as Prisma.InputJsonValue | undefined,
        quotedPriceVatIncl: input.priceVatIncl ? new Prisma.Decimal(input.priceVatIncl) : undefined,
        quotedCurrency: input.currency,
        expiresAt: new Date(Date.now() + env.SHIPPING_REQUEST_TTL_MINUTES * 60 * 1000)
      },
      create: {
        shopId: input.shopId,
        shippingRequestCode: input.shippingRequestCode,
        shippingGuid: input.shippingGuid,
        status: ShippingRequestStatus.OFFERED,
        selectedPickupPointId: input.pickupPointId,
        selectedPickupRaw: input.pickupPointRaw as Prisma.InputJsonValue | undefined,
        quotedPriceVatIncl: input.priceVatIncl ? new Prisma.Decimal(input.priceVatIncl) : undefined,
        quotedCurrency: input.currency,
        expiresAt: new Date(Date.now() + env.SHIPPING_REQUEST_TTL_MINUTES * 60 * 1000)
      }
    });

    return shippingRequest;
  }

  async markConfirmedByEvent(shippingRequestCode: string, orderCode?: string | null) {
    const request = await prisma.shippingRequest.findFirst({
      where: { shippingRequestCode }
    });

    if (!request) {
      throw new HttpError(404, 'Shipping request not found');
    }

    return prisma.shippingRequest.update({
      where: { id: request.id },
      data: {
        status: ShippingRequestStatus.CONFIRMED,
        orderCode: orderCode ?? request.orderCode
      }
    });
  }

  async markCancelledByEvent(shippingRequestCode: string) {
    const request = await prisma.shippingRequest.findFirst({
      where: { shippingRequestCode }
    });

    if (!request) {
      return null;
    }

    return prisma.shippingRequest.update({
      where: { id: request.id },
      data: { status: ShippingRequestStatus.CANCELLED }
    });
  }

  async createShipmentFromOrder(input: {
    shippingRequestId: string;
    order: any;
    carrier?: string;
  }): Promise<{ packageId: string; trackingCode?: string; labelUrl: string }> {
    const request = await prisma.shippingRequest.findUnique({
      where: { id: input.shippingRequestId }
    });

    if (!request) throw new HttpError(404, 'Shipping request not found');

    const orderPayload = this.mapOrderToBoxpi(input.order, request.selectedPickupPointId ?? undefined, input.carrier);
    await boxpiService.validatePackage(orderPayload);
    const created = await boxpiService.createPackage(orderPayload);
    const pkg = await boxpiService.getPackage(created.packageId);
    const labelUrl = boxpiService.getLabelUrl(created.packageId);

    await prisma.shippingRequest.update({
      where: { id: request.id },
      data: {
        status: ShippingRequestStatus.PACKAGE_CREATED,
        boxpiPackageId: created.packageId,
        boxpiTrackingCode: pkg?.TrackingCode ?? null,
        boxpiLabelUrl: labelUrl
      }
    });

    return {
      packageId: created.packageId,
      trackingCode: pkg?.TrackingCode ?? undefined,
      labelUrl
    };
  }

  mapOrderToBoxpi(order: any, pickupPointId?: string, carrier?: string): unknown {
    const shippingAddress = order?.order?.billingAddress ?? order?.order?.deliveryAddress ?? order?.billingAddress ?? order?.deliveryAddress ?? {};
    const customer = order?.order?.customer ?? order?.customer ?? {};
    const totalPrice = Number(order?.order?.price?.withVat ?? order?.price?.withVat ?? 0);
    const currency = String(order?.order?.currency?.code ?? order?.currency?.code ?? env.BOXPI_DEFAULT_COD_CURRENCY);
    const orderCode = String(order?.code ?? order?.order?.code ?? order?.orderCode ?? 'unknown');

    const recipient: Record<string, unknown> = {
      CountryIsoCode: String(shippingAddress.countryCode ?? env.BOXPI_DEFAULT_COUNTRY),
      ContactName: String(customer.fullName ?? shippingAddress.name ?? 'Customer'),
      ContactPhone: String(customer.phone ?? shippingAddress.phone ?? ''),
      ContactEmail: String(customer.email ?? shippingAddress.email ?? ''),
    };

    if (pickupPointId) {
      recipient.PickupPoint = pickupPointId;
    } else {
      recipient.Street = String(shippingAddress.street ?? '');
      recipient.HouseNumber = String(shippingAddress.houseNumber ?? '');
      recipient.City = String(shippingAddress.city ?? '');
      recipient.ZipCode = String(shippingAddress.zip ?? shippingAddress.zipCode ?? '');
    }

    return {
      Packages: [
        {
          Carrier: carrier ?? env.BOXPI_DEFAULT_CARRIER,
          MerchantReference: orderCode,
          Recipient: recipient,
          CoD: {
            Amount: totalPrice,
            Currency: currency
          },
          Weight: 1,
          Sizes: [10, 10, 10],
          Source: 'shoptet-addon'
        }
      ]
    };
  }
}

export const shippingService = new ShippingService();
