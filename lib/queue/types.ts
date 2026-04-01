export type JobName = 'call.transcribe' | 'call.classify' | 'creative.generate'

export interface TranscribeJobData {
  callId: string
  recordingUrl: string
  userId: string
}

export interface ClassifyJobData {
  callId: string
  transcript: string
  durationSec: number
  numberLabel: string | null
  userId: string
}

export interface CreativeGenerateJobData {
  briefId: string
  userId: string
  niche: string
  targetAudience: string
  problemClusters: string[]
  competitorHooks?: string[]
}

export type JobData = TranscribeJobData | ClassifyJobData | CreativeGenerateJobData
