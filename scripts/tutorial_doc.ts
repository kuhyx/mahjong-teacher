import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tutorialMarkdown } from '../src/tutorial/doc.ts'
import { SCENES } from '../src/tutorial/scenes.ts'

// Writes DOCS-tutorial.md and fails if a step image is missing. Make the
// images first: node scripts/e2e_tutorial.ts --touch --shots docs/tutorial
const ROOT = join(import.meta.dirname, '..')
const IMG = 'docs/tutorial'
const missing = SCENES.flatMap((s) => s.steps.map((_, i) => `${IMG}/${s.id}-${String(i + 1)}.jpg`)).filter((f) => !existsSync(join(ROOT, f)))
if (missing.length > 0) {
  process.stderr.write(`missing step images (run e2e_tutorial --touch --shots ${IMG}): ${missing.join(', ')}\n`)
  process.exit(1)
}
writeFileSync(join(ROOT, 'DOCS-tutorial.md'), `${tutorialMarkdown(SCENES, IMG)}\n`)
process.stdout.write(`wrote DOCS-tutorial.md: ${String(SCENES.length)} scenes\n`)
