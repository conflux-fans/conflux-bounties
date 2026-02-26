import buildApp from './app';
import { startWorker } from './services/verification';

const start = async () => {
    const server = buildApp();
    try {
        const port = parseInt(process.env.PORT || '3000');
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on ${port}`);

        // Start BullMQ worker only in long-lived server mode
        startWorker();
        console.log('Verification worker started');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();

