import 'dotenv/config'
import { Worker, Queue } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,
}

const publishWorker = new Worker(
  'publish',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id} — taskId: ${job.data.taskId}`)
    // Platform-specific publish logic will be added per adapter
    // This worker is the execution layer, separated from the API
    await new Promise((r) => setTimeout(r, 1000))
    console.log(`[Worker] Job ${job.id} done`)
  },
  { connection, concurrency: 5 },
)

const statsWorker = new Worker(
  'stats-collect',
  async (job) => {
    console.log(`[Worker] Collecting stats for accountId: ${job.data.accountId}`)
    // Fetch stats from platform and store snapshot
  },
  { connection, concurrency: 10 },
)

publishWorker.on('failed', (job, err) => {
  console.error(`[Worker] Publish job ${job?.id} failed:`, err.message)
})

console.log('[SocialHub Worker] Started — listening for publish & stats-collect queues')
