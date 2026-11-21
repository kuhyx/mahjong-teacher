import { execSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The board runs the CLAUDE.md `- deploy:` command verbatim from the task
// worktree (2026-11-21: "deploy runs from ~/src/mahjong-teacher, not .../wt").
// The command itself must pull ~/src/mahjong-teacher and deploy from there.
const ROOT = join(import.meta.dirname, '../..')

function deployCommand(): string {
  const m = /^- deploy: `([^`]+)`/m.exec(readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8'))
  if (!m?.[1]) throw new Error('no deploy line in CLAUDE.md')
  return m[1]
}

describe('CLAUDE.md deploy command', () => {
  it('pulls and deploys ~/src/mahjong-teacher when run from a worktree', () => {
    const home = mkdtempSync(join(tmpdir(), 'mj-home-'))
    const origin = join(home, 'origin.git')
    const git = (args: string, cwd = home): string => execSync(`git -c user.email=t@t -c user.name=t ${args}`, { cwd, encoding: 'utf8' })
    git(`init -q --bare -b main ${origin}`)
    const seed = join(home, 'seed')
    git(`clone -q ${origin} ${seed}`)
    mkdirSync(join(seed, 'scripts'))
    copyFileSync(join(ROOT, 'scripts/deploy.sh'), join(seed, 'scripts/deploy.sh'))
    git('add -A', seed)
    git('commit -qm one', seed)
    git('push -q origin HEAD:main', seed)
    git(`clone -q ${origin} ${join(home, 'src/mahjong-teacher')}`)
    writeFileSync(join(seed, 'new'), 'x')
    git('add -A', seed)
    git('commit -qm two', seed)
    git('push -q origin HEAD:main', seed)
    const bin = join(home, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'pnpm'), `#!/bin/bash\ntouch '${join(home, 'pnpm-ran')}'\nexit 97\n`)
    chmodSync(join(bin, 'pnpm'), 0o755)
    const wt = join(home, '.cache/wt')
    mkdirSync(join(wt, 'scripts'), { recursive: true })
    copyFileSync(join(ROOT, 'scripts/deploy.sh'), join(wt, 'scripts/deploy.sh'))
    const r = spawnSync('bash', ['-c', deployCommand()], { cwd: wt, env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home }, encoding: 'utf8' })
    expect(r.stderr).not.toContain('deploy runs from')
    expect(existsSync(join(home, 'pnpm-ran'))).toBe(true)
    expect(existsSync(join(home, 'src/mahjong-teacher/new'))).toBe(true)
  })
})
