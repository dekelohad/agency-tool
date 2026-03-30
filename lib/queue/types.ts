export interface AmazonAnalyzeJobData {
  analysisId: string
  keyword: string
  category: string
  asin?: string
  userId: string
}

export type JobName = 'amazon.analyze'
