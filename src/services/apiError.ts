export async function apiError(response: Response, fallback: string): Promise<Error> {
  const body = await response.text()
  if (!body) return new Error(`${fallback} (${response.status})`)
  try {
    const parsed = JSON.parse(body) as { detail?: string | Array<{ msg?: string }> }
    if (typeof parsed.detail === 'string') return new Error(parsed.detail)
    if (Array.isArray(parsed.detail)) {
      const messages = parsed.detail.map((item) => item.msg).filter(Boolean)
      if (messages.length) return new Error(messages.join('; '))
    }
  } catch {
    // Non-JSON upstream responses are still more useful than a generic code.
  }
  return new Error(body)
}
