import crypto from 'crypto'

/**
 * Validates an inbound Twilio webhook signature.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function validateTwilioWebhook(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Build string: URL + sorted key/value pairs
  const sortedKeys = Object.keys(params).sort()
  const stringToSign = url + sortedKeys.map((k) => k + params[k]).join('')

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(stringToSign, 'utf8')
    .digest('base64')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  } catch {
    // Buffers differ in length
    return false
  }
}

/** Normalises a phone number to E.164 format. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}
