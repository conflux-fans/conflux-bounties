import { FastifyInstance } from 'fastify';
import { IpfsService } from '../services/ipfs';

const ipfs = new IpfsService();

const ALLOWED_MIME = (process.env.ALLOWED_LOGO_MIME || 'image/png,image/jpeg,image/svg+xml')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean);

export async function assetsRoutes(fastify: FastifyInstance) {
  fastify.post('/logo', async (request, reply) => {
    try {
      const file = await (request as any).file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const mimetype = file.mimetype as string;
      if (!ALLOWED_MIME.includes(mimetype)) {
        return reply.status(400).send({ error: 'Unsupported logo MIME type' });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const cid = await ipfs.pinFile(buffer, file.filename, mimetype);
      return reply.send({
        cid,
        url: `ipfs://${cid}`
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(400).send({ error: err?.message ?? 'Failed to upload logo' });
    }
  });
}

