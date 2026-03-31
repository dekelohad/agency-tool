// Shared Redis connection config — used by Queue and Worker instances
export const redisConnection = {
  host: process.env.UPSTASH_REDIS_HOST!,
  port: Number(process.env.UPSTASH_REDIS_PORT ?? 6380),
  password: process.env.UPSTASH_REDIS_PASSWORD!,
  tls: {} as Record<string, never>,
  maxRetriesPerRequest: null, // required for BullMQ workers
}
