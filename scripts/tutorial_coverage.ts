import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseLog } from '../src/log/log.ts'
import { coverage } from '../src/tutorial/coverage.ts'
import { SCENES } from '../src/tutorial/scenes.ts'

// C6: every item kuhy marked in any play-through log must have a tutorial
// scene. Usage: node scripts/tutorial_coverage.ts [logs dir] [--without <scene id>]
// Prints OK and item -> scene rows, or MISSING rows and exits 1.
const args = process.argv.slice(2)
const w = args.indexOf('--without')
const without = w >= 0 ? args.splice(w, 2)[1] : undefined
const dir = args[0] ?? join(homedir(), 'data/mahjong-teacher/logs')
const logs = readdirSync(dir).filter((f) => /^play-.*\.json$/.test(f)).sort().map((f) => parseLog(readFileSync(join(dir, f), 'utf8')))
const r = coverage(logs, SCENES.filter((s) => s.id !== without))
for (const row of r.rows) {
  process.stdout.write(`${row.scenes.length > 0 ? row.scenes.join('+') : 'MISSING'}\t${row.log}/${row.item}\t${row.what.slice(0, 90)}\n`)
}
process.stdout.write(`${r.ok ? 'OK' : 'FAIL'}: ${String(r.rows.length)} marked items in ${String(logs.length)} logs, ${String(r.missing.length)} without a scene\n`)
process.exit(r.ok ? 0 : 1)
