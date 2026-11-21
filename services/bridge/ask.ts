import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Explain } from '../../src/engine/explain.ts'
import type { Correction, Mark } from '../../src/log/log.ts'
import { checkFacts, splitFacts } from './facts.ts'

// One question = one `claude -p` run on kuhy's plan (OAuth login of the CLI,
// never an API key). Follow-ups pass `--resume <session id>`. The child runs in
// --safe-mode (no CLAUDE.md, hooks, skills or MCP) with only the Read tool.

export interface AskInput {
  question: string
  state: Explain
  entities: { entity: string; label: string }[]
  marks: Mark[]
  /** Marked screenshot saved on this PC, for the model to Read. */
  shotPath: string | null
  sessionId?: string | null
}

export interface AskResult {
  answer: string
  sessionId: string
  flagged: boolean
  corrected: Correction[]
}

export interface AskConfig {
  claudeBin: string
  /** Working dir of the child; screenshots live here. */
  workDir: string
  /** Extra env for the child (tests); API keys are always stripped. */
  env: Record<string, string>
  timeoutMs?: number
}

const SYSTEM = readFileSync(join(import.meta.dirname, 'rules_reference.md'), 'utf8')
const STRIP = /^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR|CLAUDECODE.*|CLAUDE_CODE_ENTRYPOINT)$/

export function childEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !STRIP.test(k)) env[k] = v
  return { ...env, ...extra }
}

function describeMarks(marks: Mark[]): string {
  if (marks.length === 0) return 'none'
  return marks.map((m) => `${m.tool} at ${m.points.map(([x, y]) => `(${String(x)},${String(y)})`).join('-')}${m.text ? ` "${m.text}"` : ''}`).join('; ')
}

export function buildPrompt(a: AskInput): string {
  const picked = a.entities.map((e) => `- ${e.label} [${e.entity}]`).join('\n') || '- nothing picked'
  return [
    a.shotPath ? `Marked screenshot: ${a.shotPath}` : 'No screenshot for this turn.',
    `Picked items:\n${picked}`,
    `Marks drawn: ${describeMarks(a.marks)}`,
    `ENGINE STATE (truth, the player is seat 0):\n${JSON.stringify(a.state)}`,
    `Question: ${a.question}`,
  ].join('\n\n')
}

export function claudeArgs(sessionId: string | null | undefined, workDir: string): string[] {
  const args = ['-p', '--safe-mode', '--output-format', 'json', '--tools', 'Read', '--allowedTools', 'Read',
    '--permission-mode', 'dontAsk', '--strict-mcp-config', '--add-dir', workDir, '--system-prompt', SYSTEM]
  if (sessionId) args.push('--resume', sessionId)
  return args
}

function run(cfg: AskConfig, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cfg.claudeBin, args, { cwd: cfg.workDir, env: childEnv(cfg.env), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), cfg.timeoutMs ?? 180_000)
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', (e) => reject(new Error(`claude failed to start: ${e.message}`)))
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`claude exited ${String(code)}: ${err.slice(0, 400)}`))
    })
    // A binary that exits without reading stdin must not crash the bridge (EPIPE).
    child.stdin.on('error', () => undefined)
    child.stdin.end(stdin)
  })
}

export async function ask(a: AskInput, cfg: AskConfig): Promise<AskResult> {
  const out = await run(cfg, claudeArgs(a.sessionId, cfg.workDir), buildPrompt(a))
  let parsed: { result?: unknown; session_id?: unknown; is_error?: unknown }
  try {
    parsed = JSON.parse(out) as typeof parsed
  } catch {
    throw new Error(`claude returned non-JSON output: ${out.slice(0, 200)}`)
  }
  if (parsed.is_error === true || typeof parsed.result !== 'string' || typeof parsed.session_id !== 'string') {
    throw new Error(`claude returned an error result: ${out.slice(0, 200)}`)
  }
  const { body, facts } = splitFacts(parsed.result)
  const corrected = checkFacts(facts, a.state)
  return { answer: body, sessionId: parsed.session_id, flagged: corrected.length > 0, corrected }
}
