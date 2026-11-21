import { readFileSync, writeFileSync } from 'node:fs'
import { briefMarkdown } from '../src/log/brief.ts'
import { parseLog } from '../src/log/log.ts'

// Usage: pnpm tutorial-brief <play-<id>.json> [out.md]   (default DOCS-tutorial-brief.md)
const [input, out = 'DOCS-tutorial-brief.md'] = process.argv.slice(2)
if (!input) {
  process.stderr.write('usage: pnpm tutorial-brief <play-log.json> [out.md]\n')
  process.exit(2)
}
writeFileSync(out, briefMarkdown(parseLog(readFileSync(input, 'utf8'))))
process.stdout.write(`wrote ${out}\n`)
