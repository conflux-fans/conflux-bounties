import { describe, it, expect, vi, beforeAll } from 'vitest';
import buildApp from './app';

describe('buildApp', () => {
    it('returns a Fastify instance', () => {
        const app = buildApp();
        expect(app).toBeDefined();
        expect(typeof app.listen).toBe('function');
    });

    it('registers submission routes under /v1/submissions', async () => {
        const app = buildApp();
        const res = await app.inject({ method: 'GET', url: '/v1/submissions/' });
        expect(res.statusCode).toBe(200);
    });

    it('registers public routes under /v1/metadata', async () => {
        const app = buildApp();
        const res = await app.inject({ method: 'GET', url: '/v1/metadata/' });
        expect(res.statusCode).toBe(200);
    });

    it('registers assets routes under /v1/assets', async () => {
        const app = buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/v1/assets/logo'
        });
        expect([400, 404]).toContain(res.statusCode);
    });
});
