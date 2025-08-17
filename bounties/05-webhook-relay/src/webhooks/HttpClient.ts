import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type { IHttpClient } from './interfaces';
import type { DeliveryResult } from '../types';

export class HttpClient implements IHttpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      validateStatus: () => true, // Don't throw on any status code
    });
  }

  async post(
    url: string,
    data: any,
    headers: Record<string, string>,
    timeout: number
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const response: AxiosResponse = await this.client.post(url, data, {
        headers,
        timeout,
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      const result: DeliveryResult = {
        success,
        statusCode: response.status,
        responseTime,
      };

      if (!success) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            responseTime,
            error: `Request timeout after ${timeout}ms`,
          };
        }

        if (axiosError.response) {
          return {
            success: false,
            statusCode: axiosError.response.status,
            responseTime,
            error: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          };
        }

        return {
          success: false,
          responseTime,
          error: axiosError.message || 'Network error',
        };
      }

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}