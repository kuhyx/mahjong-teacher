import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// deploy.sh rewrites the systemd units to point at the checkout it runs from.
// Run from a throwaway worktree, it leaves the live units on a path that later
// vanishes (the 2026-11-21 "not found"). A stub pnpm marks "got past the guard"
// and stops the script before it touches anything real.
const script = join(import.meta.dirname, '../../scripts/deploy.sh')

function runFrom(home: string, repo: string, env: Record<string, string> = {}): { code: number | null; err: string; passed: boolean } {
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  copyFileSync(script, join(repo, 'scripts/deploy.sh'))
  const bin = join(home, 'bin')
  mkdirSync(bin, { recursive: true })
  const marker = join(home, 'pnpm-ran')
  writeFileSync(join(bin, 'pnpm'), `#!/bin/bash\ntouch '${marker}'\nexit 97\n`)
  chmodSync(join(bin, 'pnpm'), 0o755)
  const r = spawnSync('bash', [join(repo, 'scripts/deploy.sh')], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, ...env },
    encoding: 'utf8',
  })
  return { code: r.status, err: r.stderr, passed: existsSync(marker) }
}

describe('deploy.sh checkout guard', () => {
  it('refuses to run from a checkout other than ~/src/mahjong-teacher', () => {
    const home = mkdtempSync(join(tmpdir(), 'mj-home-'))
    const r = runFrom(home, join(home, '.cache/wt'))
    expect(r.passed).toBe(false)
    expect(r.code).toBe(1)
    expect(r.err).toContain(join(home, 'src/mahjong-teacher'))
  })

  it('runs from ~/src/mahjong-teacher, or anywhere with MJ_ANY_CHECKOUT=1', () => {
    const home = mkdtempSync(join(tmpdir(), 'mj-home-'))
    expect(runFrom(home, join(home, 'src/mahjong-teacher')).passed).toBe(true)
    const home2 = mkdtempSync(join(tmpdir(), 'mj-home-'))
    expect(runFrom(home2, join(home2, '.cache/wt'), { MJ_ANY_CHECKOUT: '1' }).passed).toBe(true)
  })
})
