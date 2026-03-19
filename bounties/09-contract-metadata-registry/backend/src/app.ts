import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { submissionRoutes } from './routes/submission';
import { publicRoutes } from './routes/public';
import { assetsRoutes } from './routes/assets';
import dotenv from 'dotenv';

dotenv.config();

const buildApp = () => {
    const server = Fastify({
        logger: false
    });

    server.register(cors, {
        origin: '*'
    });

    server.register(rateLimit, {
        max: 60,
        timeWindow: '1 minute'
    });

    server.register(multipart);

    server.register(submissionRoutes, { prefix: '/v1/submissions' });
    server.register(publicRoutes, { prefix: '/v1/metadata' });
    server.register(assetsRoutes, { prefix: '/v1/assets' });

    return server;
};

export default buildApp;

