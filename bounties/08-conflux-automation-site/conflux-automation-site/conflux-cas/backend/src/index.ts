import 'dotenv/config';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { migrate } from './db/migrate.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import jobsRouter from './routes/jobs.js';
import poolsRouter from './routes/pools.js';
import systemRouter from './routes/system.js';
import sseRouter from './sse/events.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Run DB migrations on startup
migrate();

const app: Express = express();

// Build the allowed-origin list from env (comma-separated) or default to both
// http and https localhost so `pnpm dev` and `pnpm dev:https` both work.
const rawOrigins =
  process.env.CORS_ORIGIN ?? 'http://localhost:3000,https://localhost:3000';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server, same-origin proxy)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/jobs', jobsRouter);
app.use('/admin', adminRouter);
app.use('/pools', poolsRouter);
app.use('/sse', sseRouter);
app.use('/system', systemRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT}`);
});

export { app };
