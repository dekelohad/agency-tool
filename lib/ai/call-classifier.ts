import { z } from 'zod'
import { chat } from './client'

export const CallClassificationSchema = z.object({
  is_billable: z.boolean(),
  category: z.enum([
    'service_request',
    'spam',
    'agency',
    'lead_vendor',
    'job_seeker',
    'wrong_number',
    'irrelevant_service',
  ]),
  service_type: z.string().nullable(),
  location: z.string().nullable(),
  intent: z.enum(['quote', 'booking', 'emergency']).nullable(),
  duration_valid: z.boolean(),
  reason: z.string(),
})

export type CallClassification = z.infer<typeof CallClassificationSchema>

export function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in response')
  return JSON.parse(match[0])
}

export async function classifyCall({
  transcript,
  durationSec,
  numberLabel,
}: {
  transcript: string
  durationSec: number
  numberLabel: string | null
}): Promise<CallClassification> {
  const text = await chat(
    `You are a pay-per-call lead quality classifier. Analyze this inbound call and return a JSON classification.

Campaign number label: ${numberLabel ?? 'unknown'}
Call duration: ${durationSec} seconds

Transcript:
${transcript}

Classification rules:
- is_billable: true ONLY when category is "service_request" AND duration_valid is true
- duration_valid: true when call duration >= 90 seconds (meaningful conversation)
- category: "service_request" | "spam" | "agency" | "lead_vendor" | "job_seeker" | "wrong_number" | "irrelevant_service"
- service_type: specific service requested (e.g. "HVAC repair", "water damage restoration") or null
- location: city/area mentioned, or null
- intent: "quote" | "booking" | "emergency" or null
- reason: 1-2 sentence plain English explanation shown to the client if they dispute this classification

Return ONLY valid JSON with no additional text:
{
  "is_billable": boolean,
  "category": string,
  "service_type": string | null,
  "location": string | null,
  "intent": string | null,
  "duration_valid": boolean,
  "reason": string
}`,
    512
  )

  const parsed = extractJson(text)
  return CallClassificationSchema.parse(parsed)
}
