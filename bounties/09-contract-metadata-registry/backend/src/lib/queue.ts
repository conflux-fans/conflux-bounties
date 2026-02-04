import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";

export const redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const pinQueue = new Queue("pin", { connection: redisConnection });
export const verifyQueue = new Queue("verify", { connection: redisConnection });
