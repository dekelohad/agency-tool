import { transcribeWorker } from './transcribe.worker'
import { classifyWorker } from './classify.worker'
import { creativeWorker } from './creative.worker'

const workers = [transcribeWorker, classifyWorker, creativeWorker]

for (const worker of workers) {
  worker.on('completed', (job) => {
    console.log(`[${job.queueName}] job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[${job?.queueName}] job ${job?.id} failed:`, err.message)
  })
}

console.log('[workers] transcribe, classify, creative workers started')
