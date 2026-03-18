import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { db, statements } from './database.js';
import { ethers } from 'ethers';
import { z } from 'zod';
import 'dotenv/config';

const fastify = Fastify({ logger: true });

// Register plugins
await fastify.register(cors, { origin: true });
await fastify.register(jwt, { secret: process.env.JWT_SECRET || 'conflux-automation-secret-2024' });
await fastify.register(websocket);

// WebSocket connections for live updates
const wsClients = new Set();

fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, req /* FastifyRequest */) => {
    wsClients.add(connection.socket);
    
    connection.socket.on('message', message => {
      // Handle incoming messages if needed
      connection.socket.send('Connected to Conflux Automation');
    });
    
    connection.socket.on('close', () => {
      wsClients.delete(connection.socket);
    });
  });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Auth middleware
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Validation schemas
const createJobSchema = z.object({
  jobType: z.number().min(0).max(3),
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  targetPrice: z.string().regex(/^\d+(\.\d+)?$/),
  maxSlippage: z.number().min(0).max(5000),
  interval: z.number().min(0),
  maxExecutions: z.number().min(0),
  blockchainJobId: z.number().optional()
});

// Routes

// Health check
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Get all jobs for authenticated user
fastify.get('/api/jobs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userAddress = request.user.address;
  const jobs = statements.getJobsByOwner.all(userAddress);
  return jobs;
});

// Get specific job
fastify.get('/api/jobs/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const job = statements.getJob.get(request.params.id);
  
  if (!job) {
    reply.code(404).send({ error: 'Job not found' });
    return;
  }
  
  // Verify ownership
  if (job.owner !== request.user.address) {
    reply.code(403).send({ error: 'Not authorized' });
    return;
  }
  
  return job;
});

// Create new job
fastify.post('/api/jobs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const data = createJobSchema.parse(request.body);
        
    const now = Date.now();
    const nextExecution = data.interval > 0 ? now + data.interval : now;
    
    const result = statements.createJob.run(
      request.user.address,
      data.jobType,
      data.tokenIn,
      data.tokenOut,
      data.amount,
      data.targetPrice,
      data.maxSlippage,
      data.interval,
      nextExecution,
      0, // executions
      data.maxExecutions,
      0, // status: ACTIVE
      data.blockchainJobId || null,
      now,
      now
    );
    
    const jobId = result.lastInsertRowid;
    const job = statements.getJob.get(jobId);
    
    // Log audit
    statements.createAuditLog.run(
      'CREATE_JOB',
      'job',
      jobId,
      request.user.address,
      JSON.stringify(data),
      now
    );
    
    // Broadcast new job
    broadcast({ type: 'job_created', job });
    
    reply.code(201).send(job);
  } catch (error) {
    fastify.log.error(error);
    reply.code(400).send({ error: error.message });
  }
});

// Update job status (pause/resume)
fastify.patch('/api/jobs/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const { status } = request.body;
  const jobId = request.params.id;
  
  const job = statements.getJob.get(jobId);
  
  if (!job) {
    reply.code(404).send({ error: 'Job not found' });
    return;
  }
  
  if (job.owner !== request.user.address) {
    reply.code(403).send({ error: 'Not authorized' });
    return;
  }
  
  statements.updateJobStatus.run(status, Date.now(), jobId);
  
  const updatedJob = statements.getJob.get(jobId);
  
  statements.createAuditLog.run(
    'UPDATE_JOB_STATUS',
    'job',
    jobId,
    request.user.address,
    JSON.stringify({ oldStatus: job.status, newStatus: status }),
    Date.now()
  );
  
  broadcast({ type: 'job_updated', job: updatedJob });
  
  return updatedJob;
});

// Cancel job
fastify.delete('/api/jobs/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const jobId = request.params.id;
  const job = statements.getJob.get(jobId);
  
  if (!job) {
    reply.code(404).send({ error: 'Job not found' });
    return;
  }
  
  if (job.owner !== request.user.address) {
    reply.code(403).send({ error: 'Not authorized' });
    return;
  }
  
  // Update status to CANCELLED
  statements.updateJobStatus.run(2, Date.now(), jobId); // 2 = CANCELLED
  
  statements.createAuditLog.run(
    'CANCEL_JOB',
    'job',
    jobId,
    request.user.address,
    null,
    Date.now()
  );
  
  broadcast({ type: 'job_cancelled', jobId });
  
  return { success: true, jobId };
});

// Get executions for a job
fastify.get('/api/jobs/:id/executions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const job = statements.getJob.get(request.params.id);
  
  if (!job) {
    reply.code(404).send({ error: 'Job not found' });
    return;
  }
  
  if (job.owner !== request.user.address) {
    reply.code(403).send({ error: 'Not authorized' });
    return;
  }
  
  const executions = statements.getExecutionsByJob.all(request.params.id);
  return executions;
});

// Get all executions for user
fastify.get('/api/executions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const limit = request.query.limit || 50;
  const executions = statements.getExecutionsByOwner.all(request.user.address, limit);
  return executions;
});

// Get audit logs (admin only)
fastify.get('/api/admin/audit-logs', async (request, reply) => {
  const limit = request.query.limit || 100;
  const logs = statements.getAuditLogs.all(limit);
  return logs;
});

// Auth endpoint - verify wallet signature
fastify.post('/api/auth/verify', async (request, reply) => {
  const { message, signature } = request.body;
  
  try {
    // Recover address from signature
    const address = ethers.verifyMessage(message, signature);
    
    // Generate JWT
    const token = fastify.jwt.sign({ address }, { expiresIn: '7d' });
    
    return { token, address };
  } catch (error) {
    reply.code(401).send({ error: 'Invalid signature' });
  }
});

// Get supported tokens
fastify.get('/api/tokens', async (request, reply) => {
  // Default supported tokens on Conflux eSpace
  const tokens = [
    { address: '0x0000000000000000000000000000000000000000', symbol: 'CFX', name: 'Conflux', decimals: 18 },
    { address: '0xfeacf96889d468ebbbca73eb0e23d923c3e6b0a8', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { address: '0x8971f8e1b33e18c1ab4a6e0c98f9cb4a3c0f222c', symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    // Add more tokens as needed
  ];
  
  return tokens;
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
