import { Redis } from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

export async function enqueueNotification(payload: Record<string, unknown>): Promise<void> {
  await redis.lpush("notifications:queue", JSON.stringify({ ...payload, enqueuedAt: Date.now() }));
}
