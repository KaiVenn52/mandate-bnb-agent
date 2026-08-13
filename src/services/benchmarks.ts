export type BenchmarkTask = {
  id: string
  title: string
  category: string
  high_stakes: boolean
  benchmark_version: string
  input_sha256: string
  mandate: Record<string, unknown>
  candidates: Array<{ id: string } & Record<string, unknown>>
  rubric: string[]
  position?: Record<string, unknown>
}

export type BenchmarkRun = {
  task_id: string
  benchmark_version: string
  input_sha256: string
  quality_score: number
  quality_max: number
  server_compute_ms?: number
  elapsed_ms?: number
  timing_source?: string
  output_sha256?: string
  output: Record<string, unknown>
  client_roundtrip_ms?: number
  recorded_at_utc?: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed (${response.status})`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('Benchmark API returned an unsupported response.')
  }
  return response.json() as Promise<T>
}

export async function loadBenchmarks(): Promise<BenchmarkTask[]> {
  const data = await jsonRequest<{ tasks: BenchmarkTask[] }>('/benchmarks')
  return data.tasks
}

export async function runBenchmarkAgent(taskId: string): Promise<BenchmarkRun> {
  const started = performance.now()
  const result = await jsonRequest<BenchmarkRun>(`/benchmarks/${taskId}/agent-run`, { method: 'POST' })
  return {
    ...result,
    client_roundtrip_ms: Math.round((performance.now() - started) * 10) / 10,
    recorded_at_utc: new Date().toISOString(),
  }
}

export async function scoreHumanBaseline(
  taskId: string,
  values: { decision: string; metric: number; rejected: string[]; recommendation: string; elapsed_ms: number },
): Promise<BenchmarkRun> {
  const result = await jsonRequest<BenchmarkRun>(`/benchmarks/${taskId}/baseline-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
  return { ...result, recorded_at_utc: new Date().toISOString() }
}
