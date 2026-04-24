import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { HCMSyncException } from '../../common/exceptions/hcm-sync.exception';
import { InvalidDimensionsException } from '../../common/exceptions/invalid-dimensions.exception';
import { TimeoutException } from '../../common/exceptions/timeout.exception';

/**
 * Outbound HCM HTTP client with retries and exponential backoff.
 */
export interface MockBalancePayload {
  balance: number;
  version: string;
  leaveType?: string;
}

export interface MockCreateTimeoffResponse {
  success: boolean;
  newBalance: number;
  hcmRefId: string;
  version?: string;
}

@Injectable()
export class HcmApiService {
  private readonly logger = new Logger(HcmApiService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.HCM_API_URL ?? 'http://127.0.0.1:3001',
      timeout: 5000,
      headers: {
        'x-api-key': process.env.HCM_API_KEY ?? '',
      },
    });
  }

  /**
   * Fetches authoritative balance from mock/real HCM.
   */
  async getBalance(employeeId: string, locationId: string, leaveType = 'ANNUAL'): Promise<MockBalancePayload> {
    return this.requestWithRetry(async () => {
      const { data } = await this.client.get<Record<string, unknown>>(
        `/mock/balance/${encodeURIComponent(employeeId)}/${encodeURIComponent(locationId)}`,
        { params: { leaveType } },
      );
      return {
        balance: Number(data.balance),
        version: String(data.version),
        leaveType: typeof data.leaveType === 'string' ? data.leaveType : undefined,
      };
    });
  }

  /**
   * Creates a time-off record upstream (deducts balance in HCM for mock).
   */
  async createTimeoff(body: {
    employeeId: string;
    locationId: string;
    days: number;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<MockCreateTimeoffResponse> {
    return this.requestWithRetry(async () => {
      const { data } = await this.client.post<MockCreateTimeoffResponse>('/mock/timeoff/create', body);
      return data;
    });
  }

  /**
   * Batch sync endpoint used by reconciliation flows.
   */
  async batchBalanceSync(records: Array<{ employeeId: string; locationId: string; balance?: number }>): Promise<unknown> {
    return this.requestWithRetry(async () => {
      const { data } = await this.client.post('/mock/balance/sync', { records });
      return data;
    });
  }

  /**
   * Executes request with exponential backoff for transient failures.
   */
  async requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 4;
    let attempt = 0;
    let backoffMs = 100;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        const axiosErr = err as AxiosError;
        const status = axiosErr.response?.status;
        const retriable =
          !axiosErr.response ||
          (typeof status === 'number' && status >= 500 && status < 600) ||
          axiosErr.code === 'ECONNABORTED' ||
          axiosErr.code === 'ETIMEDOUT';

        this.logger.warn(`HCM call failed (attempt ${attempt}/${maxAttempts})`, axiosErr.message);

        if (!retriable || attempt >= maxAttempts) {
          this.mapAndThrow(axiosErr);
        }

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 2000);
      }
    }
  }

  private mapAndThrow(err: AxiosError): never {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new TimeoutException();
    }

    const data = err.response?.data as { error?: string; message?: string } | undefined;
    if (err.response?.status === 503 && data?.error === 'TIMEOUT') {
      throw new TimeoutException(data.message ?? 'HCM timed out.');
    }

    if (err.response?.status === 404) {
      throw new InvalidDimensionsException('Employee/location not found in HCM.');
    }

    if (data?.error === 'INSUFFICIENT_BALANCE') {
      throw new HCMSyncException('HCM reported insufficient balance.');
    }

    if (err.response?.status === 500) {
      throw new HCMSyncException('HCM returned an internal error.');
    }

    throw new HCMSyncException(err.message || 'HCM request failed.');
  }
}
