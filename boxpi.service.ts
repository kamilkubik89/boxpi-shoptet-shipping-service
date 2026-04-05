import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { HttpError } from '../modules/common/http-error';

export interface PickupPointDto {
  id: string;
  name: string;
  city: string;
  address: string;
  zip: string;
  carrier: string;
  openingHours?: string;
  raw: unknown;
}

export class BoxpiService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.BOXPI_BASE_URL,
      timeout: env.HTTP_TIMEOUT_MS,
      headers: {
        'x-api-key': env.BOXPI_API_KEY,
        'Content-Type': 'application/json'
      }
    });
  }

  async getPickupPoints(carrier: string): Promise<PickupPointDto[]> {
    const { data } = await this.client.get(`/data/carriers/${encodeURIComponent(carrier)}/points`);
    const presignedUrl = data?.url;
    if (!presignedUrl) {
      throw new HttpError(502, 'Boxpi did not return pickup points URL');
    }

    const pointsResponse = await axios.get(presignedUrl, { timeout: env.HTTP_TIMEOUT_MS });
    const points = Array.isArray(pointsResponse.data) ? pointsResponse.data : [];

    return points.map((point: Record<string, unknown>) => {
      const openings = Array.isArray(point.Openings)
        ? point.Openings.map((item: Record<string, unknown>) => `${item.Day}: ${item.OpenHours}`).join(', ')
        : undefined;

      return {
        id: String(point.PickupPoint ?? ''),
        name: String(point.Name ?? 'Pickup point'),
        city: String(point.City ?? ''),
        address: String(point.Address ?? ''),
        zip: String(point.ZipCode ?? ''),
        carrier,
        openingHours: openings,
        raw: point
      };
    }).filter((p) => p.id);
  }

  async validatePackage(payload: unknown): Promise<void> {
    await this.client.post('/packages/validation', payload);
  }

  async createPackage(payload: unknown): Promise<{ packageId: string; status: string }> {
    const { data } = await this.client.post('/packages', payload);
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first?.PackageId) {
      throw new HttpError(502, 'Boxpi package creation returned unexpected response', data);
    }

    return {
      packageId: String(first.PackageId),
      status: String(first.Status ?? 'unknown')
    };
  }

  async getPackage(packageId: string): Promise<any> {
    const { data } = await this.client.get(`/packages/${encodeURIComponent(packageId)}`);
    return data;
  }

  getLabelUrl(packageId: string): string {
    return `${env.BOXPI_BASE_URL}/labels/${encodeURIComponent(packageId)}.pdf`;
  }
}

export const boxpiService = new BoxpiService();
