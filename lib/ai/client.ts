/** Minimal DeepSeek chat client (OpenAI-compatible API, no extra package needed). */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

export async function chat(
  prompt: string,
  maxTokens = 1024
): Promise<string> {
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}: ${await res.text()}`)
  }

  type DeepSeekResponse = {
    choices: Array<{ message: { content: string } }>
  }

  const data = (await res.json()) as DeepSeekResponse
  const text = data.choices[0]?.message?.content

  if (!text) throw new Error('Empty response from DeepSeek')
  return text
}
