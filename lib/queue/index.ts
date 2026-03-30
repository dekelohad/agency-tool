import { Queue } from 'bullmq'
import type { AmazonAnalyzeJobData } from './types'

// Shared connection config — used by both Queue and Worker
export const redisConnection = {
  host: process.env.UPSTASH_REDIS_HOST!,
  port: Number(process.env.UPSTASH_REDIS_PORT ?? 6380),
  password: process.env.UPSTASH_REDIS_PASSWORD!,
  tls: {} as Record<string, never>,
  maxRetriesPerRequest: null, // required for BullMQ workers
}

export const amazonQueue = new Queue<AmazonAnalyzeJobData>('amazon', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})
