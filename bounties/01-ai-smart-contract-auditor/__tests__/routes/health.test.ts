import { NextRequest } from 'next/server';
import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  describe('GET', () => {
    it('should return healthy status', async () => {
      const request = new NextRequest('http://localhost/api/health');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });
});